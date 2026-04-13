import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessibleOwnerIds, assertAgencyCanAccessOwner } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const unitId = searchParams.get("unit_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const contactId = searchParams.get("contact_id");

    const ds = await getDataSource();
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return ok([]);
    let qb = ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.unit", "unit")
      .leftJoinAndSelect("c.property", "property")
      .where("c.owner_id IN (:...ownerIds)", { ownerIds })
      .orderBy("c.start_date", "DESC");

    if (propertyId) qb = qb.andWhere("c.property_id = :propertyId", { propertyId });
    if (unitId) qb = qb.andWhere("c.unit_id = :unitId", { unitId });
    if (status) qb = qb.andWhere("c.status = :status", { status });
    if (dateFrom) qb = qb.andWhere("c.start_date >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("c.start_date <= :dateTo", { dateTo });
    if (contactId) qb = qb.andWhere("c.contact_id = :contactId", { contactId });

    const contracts = await qb.getMany();
    return ok(contracts);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();

    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");
    const ownerId = String(body.owner_id ?? user.userId);
    const can = await assertAgencyCanAccessOwner(ds, user, ownerId);
    if (!can) return unauthorized();

    // Accept aliases: rent_amount/rent_total → rent_total_sar, payment_period/payment_frequency → payment_frequency
    const rentTotal = body.rent_total_sar ?? body.rent_amount ?? null;
    const payFreq = body.payment_frequency ?? body.payment_period ?? null;

    const contract = repo.create({
      owner_id: ownerId,
      property_id: body.property_id ?? null,
      unit_id: body.unit_id ?? null,
      contact_id: body.contact_id ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      rent_total_sar: rentTotal ? Number(rentTotal) : null,
      rent_amount_sar: body.rent_amount_sar ? Number(body.rent_amount_sar) : null,
      payment_frequency: payFreq,
      installments_count: body.installments_count ? Number(body.installments_count) : null,
      status: body.status ?? "active",
      notes: body.notes ?? null,
      extra: body.extra ?? null,
    } as any);

    await repo.save(contract);

    // Patch extra fields via raw SQL in case TypeORM entity metadata cache is stale
    const contractId = (contract as any).id;
    if (body.notes) {
      await ds.query("UPDATE contracts SET notes = $1 WHERE id = $2", [body.notes, contractId]);
      (contract as any).notes = body.notes;
    }

    // Update unit status to occupied if assigned
    if (body.unit_id) {
      await ds.getRepository("Unit").update(body.unit_id, { status: "occupied" } as any);
    }

    // Auto-update property status to "active" when an active contract is created
    if (body.property_id && (body.status ?? "active") === "active") {
      await ds.query("UPDATE properties SET status = 'active' WHERE id = $1", [body.property_id]);
    }

    // Save payment schedule if provided
    const payments = Array.isArray(body.payments) ? body.payments : [];
    if (payments.length > 0) {
      const payRepo = ds.getRepository("ContractPayment");
      for (const p of payments) {
        if (!p.due_date || Number(p.amount_sar) <= 0) continue;
        const payment = payRepo.create({
          contract_id: (contract as any).id,
          amount_sar: Number(p.amount_sar),
          due_date: p.due_date,
          status: p.status ?? "pending",
          notes: p.notes ?? null,
        } as any);
        await payRepo.save(payment);
      }
    }

    return created(contract);
  } catch (err) {
    return serverError(err);
  }
}
