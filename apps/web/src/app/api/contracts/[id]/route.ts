import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { denyIfOwnerCannotManageTenantContracts } from "@/lib/mutate-guard";
import { ownerHidesTenantPii, paymentsByContractId, sanitizeContractForOwner } from "@/lib/owner-tenant-privacy";

async function assertCanAccessContract(ds: any, user: any, contract: any) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") {
    return String((contract as any).owner_id) === String(user.userId);
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const pid = String((contract as any).property_id ?? "");
  if (!pid) return false;
  if (officeId) {
    const linked = await ds.query(
      "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
      [officeId, pid]
    );
    return Array.isArray(linked) && linked.length > 0;
  }
  const rows = await ds.query(
    `SELECT 1 AS ok FROM properties p
     WHERE p.id = $1 AND p.deleted_at IS NULL
       AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = p.owner_id
           AND u.created_by_agency_id = $2
           AND u.deleted_at IS NULL
       ))
     LIMIT 1`,
    [pid, agencyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();

    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.unit", "unit")
      .leftJoinAndSelect("c.property", "property")
      .where("c.id = :id", { id })
      .getOne();

    if (!contract) return unauthorized();
    if (!(await assertCanAccessContract(ds, user, contract))) return unauthorized();
    if (!ownerHidesTenantPii(user)) return ok(contract);

    const payMap = await paymentsByContractId(ds, [String(id)]);
    return ok(sanitizeContractForOwner(contract as Record<string, unknown>, payMap[String(id)] ?? []));
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const denied = denyIfOwnerCannotManageTenantContracts(user);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");

    const contract = await repo.findOne({ where: { id } as any });
    if (!contract) return unauthorized();
    if (!(await assertCanAccessContract(ds, user, contract))) return unauthorized();

    const updates: Record<string, any> = {};
    const fields = [
      "status",
      "start_date",
      "end_date",
      "unit_id",
      "contact_id",
      "extra",
      "rent_total_sar",
      "rent_amount_sar",
      "notes",
      "payment_frequency",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    await repo.update(id, updates);

    if (Array.isArray(body.payments)) {
      await ds.getRepository("ContractPayment").delete({ contract_id: id } as any);
      const payRepo = ds.getRepository("ContractPayment");
      for (const p of body.payments) {
        if (!p?.due_date || Number(p?.amount_sar) <= 0) continue;
        const payment = payRepo.create({
          contract_id: id,
          amount_sar: Number(p.amount_sar),
          due_date: p.due_date,
          status: p.status ?? "pending",
          notes: p.notes ?? null,
        } as any);
        await payRepo.save(payment);
      }
    }

    const updated = await repo.findOne({ where: { id } as any });

    // Sync property status when contract status changes
    if (body.status && (contract as any).property_id) {
      const propId = (contract as any).property_id;
      if (body.status === "active") {
        await ds.getRepository("Property").update(propId, { status: "active" } as any);
      } else if (body.status === "cancelled" || body.status === "expired" || body.status === "ended") {
        // Check if any other active contract exists for this property
        const otherActive = await ds.getRepository("Contract").createQueryBuilder("c")
          .where("c.property_id = :propId", { propId })
          .andWhere("c.id != :id", { id })
          .andWhere("c.status = :status", { status: "active" })
          .getCount();
        if (otherActive === 0) {
          await ds.getRepository("Property").update(propId, { status: "vacant" } as any);
        }
      }
    }

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const denied = denyIfOwnerCannotManageTenantContracts(user);
    if (denied) return denied;

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");

    const contract = await repo.findOne({ where: { id } as any });
    if (!contract) return unauthorized();
    if (!(await assertCanAccessContract(ds, user, contract))) return unauthorized();

    // Delete associated payments first
    await ds.getRepository("ContractPayment").delete({ contract_id: id } as any);

    // Free up the unit
    if ((contract as any).unit_id) {
      await ds.getRepository("Unit").update((contract as any).unit_id, { status: "vacant" } as any);
    }

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
