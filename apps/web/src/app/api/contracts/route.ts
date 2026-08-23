export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { jsonResponse } from "@/lib/errors";
import { ownerHidesTenantPii, paymentsByContractId, sanitizeContractForOwner } from "@/lib/owner-tenant-privacy";
import { generatePaymentSchedule } from "@/lib/auto-payments";
import { validationFailed } from "@/lib/validation";
import { contractSchema, frequencyToEnglish, frequencyToArabic } from "@/lib/validation/contracts";
import {
  withAuth,
  resolveContext,
  requireCapability,
  assertPropertyAccess,
  type UserContext,
} from "@/lib/auth/scope";

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
      const propertyIds = Array.from(new Set((propRows ?? []).map((r: { id?: string }) => String(r.id)).filter(Boolean)));
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
    if (!ownerHidesTenantPii(user)) {
      return ok(
        contracts.map((c: any) => ({
          ...c,
          payment_frequency: frequencyToArabic(c.payment_frequency),
        }))
      );
    }

    const ids = contracts.map((c: { id?: string }) => String(c.id)).filter(Boolean);
    const payMap = await paymentsByContractId(ds, ids);
    return ok(
      contracts.map((c: Record<string, unknown>) => {
        const safe = sanitizeContractForOwner(c, payMap[String(c.id)] ?? []);
        safe.payment_frequency = frequencyToArabic(safe.payment_frequency as string | null | undefined) as any;
        return safe;
      })
    );
  } catch (err) {
    return serverError(err);
  }
}

export const POST = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireCapability(ctx, "contracts_mutate");
    return ctx;
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("البيانات مطلوبة");

    const parsed = contractSchema.safeParse(body);
    if (!parsed.success) throw validationFailed(parsed.error);
    const data = parsed.data;

    const ds = await getDataSource();
    const propertyId = data.property_id;
    await assertPropertyAccess(ctx, propertyId);

    const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } });
    if (!prop) throw badRequest("العقار غير موجود");
    const ownerId = String((prop as { owner_id?: string }).owner_id);

    // Uniqueness per office (the schema already upper-cased and trimmed the number)
    if (data.contract_number) {
      const existing = await ds.query(
        `SELECT 1 AS ok FROM contracts WHERE contract_number = $1 AND office_id = $2 LIMIT 1`,
        [data.contract_number, ctx.officeId]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return jsonResponse({ error: "Contract number already exists in this office" }, 409);
      }
    }

    // Accept aliases: rent_amount/rent_total -> rent_total_sar,
    // payment_period -> payment_frequency, tenant_id -> contact_id
    const rentTotal = data.rent_total_sar ?? data.rent_amount ?? null;
    const payFreq = data.payment_frequency ?? data.payment_period ?? null;
    const storedFreq = payFreq ? frequencyToEnglish(payFreq) : null;

    const repo = ds.getRepository("Contract");
    const contract = repo.create({
      owner_id: ownerId,
      property_id: propertyId,
      unit_id: data.unit_id ?? null,
      contact_id: data.contact_id ?? data.tenant_id ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      rent_total_sar: rentTotal != null ? Number(rentTotal) : null,
      rent_amount_sar: data.rent_amount_sar != null ? Number(data.rent_amount_sar) : null,
      payment_frequency: storedFreq,
      installments_count: data.installments_count != null ? Number(data.installments_count) : null,
      status: data.status ?? "active",
      notes: data.notes ?? null,
      contract_number: data.contract_number ?? null,
      office_id: ctx.officeId,
      extra:
        data.extra ?? (data.contract_number ? { contract_number: data.contract_number } : null),
    });
    await repo.save(contract);

    const contractId = (contract as { id?: string }).id;
    if (data.notes) {
      await ds.query("UPDATE contracts SET notes = $1 WHERE id = $2", [data.notes, contractId]);
      (contract as { notes?: string }).notes = data.notes;
    }

    // Update unit status to occupied if assigned
    if (data.unit_id) {
      await ds.getRepository("Unit").update(data.unit_id, { status: "occupied" });
    }

    // Auto-update property status to "active" when an active contract is created
    if ((data.status ?? "active") === "active") {
      await ds.query("UPDATE properties SET status = 'active' WHERE id = $1", [propertyId]);
    }

    // Build payment schedule: explicit payments take priority, else auto-generate from contract terms
    let payments: any[] = Array.isArray(data.payments) ? (data.payments as any[]) : [];
    if (payments.length === 0) {
      const c = contract as {
        rent_total_sar?: number | string;
        start_date?: string;
        end_date?: string;
        payment_frequency?: string | null;
        installments_count?: number | string;
      };
      const rentTotalVal = c.rent_total_sar ? Number(c.rent_total_sar) : null;
      const startDate = c.start_date;
      const endDate = c.end_date;
      const freq = c.payment_frequency;
      const instCount = c.installments_count;
      if (rentTotalVal && startDate && endDate && (freq || instCount)) {
        payments = generatePaymentSchedule({
          rent_total_sar: rentTotalVal,
          start_date: startDate,
          end_date: endDate,
          payment_frequency: freq ?? null,
          installments_count: instCount ? Number(instCount) : null,
        });
      }
    }
    if (payments.length > 0) {
      const payRepo = ds.getRepository("ContractPayment");
      for (const p of payments) {
        if (!p.due_date || Number(p.amount_sar) <= 0) continue;
        const payment = payRepo.create({
          contract_id: contractId,
          amount_sar: Number(p.amount_sar),
          due_date: p.due_date,
          status: p.status ?? "pending",
          notes: p.notes ?? null,
        });
        await payRepo.save(payment);
      }
    }

    return created(contract);
  }
);
