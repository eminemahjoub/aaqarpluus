import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { denyIfOwnerCannotManageTenantContracts } from "@/lib/mutate-guard";
import { ownerHidesTenantPii, paymentsByContractId, sanitizeContractForOwner } from "@/lib/owner-tenant-privacy";
import { generatePaymentSchedule } from "@/lib/auto-payments";

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
    const userType = String(user.userType ?? "");
    let qb = ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.unit", "unit")
      .leftJoinAndSelect("c.property", "property")
      .orderBy("c.start_date", "DESC");

    if (userType === "agency") {
      const agencyId = String(user.userId);
      const propRows = await ds.query(
        `SELECT id FROM properties
         WHERE deleted_at IS NULL
           AND (created_by_agency_id = $1 OR owner_id = $1 OR EXISTS (
             SELECT 1 FROM users u
             WHERE u.id = owner_id
               AND u.created_by_agency_id = $1
               AND u.deleted_at IS NULL
           ))`,
        [agencyId]
      );
      const propertyIds = Array.from(new Set((propRows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
      if (propertyIds.length === 0) return ok([]);
      qb = qb.where("c.property_id IN (:...propertyIds)", { propertyIds });
    } else {
      qb = qb.where("c.owner_id = :ownerId", { ownerId: user.userId });
    }

    if (propertyId) qb = qb.andWhere("c.property_id = :propertyId", { propertyId });
    if (unitId) qb = qb.andWhere("c.unit_id = :unitId", { unitId });
    if (status) qb = qb.andWhere("c.status = :status", { status });
    if (dateFrom) qb = qb.andWhere("c.start_date >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("c.start_date <= :dateTo", { dateTo });
    if (contactId) qb = qb.andWhere("c.contact_id = :contactId", { contactId });

    const contracts = await qb.getMany();
    if (!ownerHidesTenantPii(user)) return ok(contracts);

    const ids = contracts.map((c: any) => String(c.id)).filter(Boolean);
    const payMap = await paymentsByContractId(ds, ids);
    return ok(
      contracts.map((c: any) => sanitizeContractForOwner(c as Record<string, unknown>, payMap[String(c.id)] ?? []))
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const denied = denyIfOwnerCannotManageTenantContracts(user);
    if (denied) return denied;

    const body = await req.json();

    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");
    const propertyId = body.property_id ? String(body.property_id) : null;
    if (!propertyId) return badRequest("معرف العقار مطلوب");

    const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
    if (!prop) return badRequest("العقار غير موجود");

    // Verify agency can access this property
    const userType = String(user.userType ?? "");
    if (userType === "agency") {
      const agencyId = String(user.userId);
      const officeId = user.officeId ? String(user.officeId) : null;
      if (officeId) {
        const linked = await ds.query(
          "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
          [officeId, propertyId]
        );
        if (!Array.isArray(linked) || linked.length === 0) return unauthorized();
      } else {
        const okRow = await ds.query(
          `SELECT 1 AS ok FROM properties p
           WHERE p.id = $1 AND p.deleted_at IS NULL
             AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
               SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = $2
                 AND u.deleted_at IS NULL
             ))
           LIMIT 1`,
          [propertyId, agencyId]
        );
        if (!Array.isArray(okRow) || okRow.length === 0) return unauthorized();
      }
    }

    const ownerId = String((prop as any).owner_id);

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

    // Build payment schedule: explicit payments take priority, else auto-generate from contract terms
    let payments = Array.isArray(body.payments) ? body.payments : [];
    if (payments.length === 0) {
      const rentTotal = (contract as any).rent_total_sar ? Number((contract as any).rent_total_sar) : null;
      const startDate = (contract as any).start_date;
      const endDate = (contract as any).end_date;
      const freq = (contract as any).payment_frequency;
      const instCount = (contract as any).installments_count;
      if (rentTotal && startDate && endDate && (freq || instCount)) {
        payments = generatePaymentSchedule({
          rent_total_sar: rentTotal,
          start_date: startDate,
          end_date: endDate,
          payment_frequency: freq,
          installments_count: instCount,
        });
      }
    }
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
