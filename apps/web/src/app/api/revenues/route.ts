export const dynamic = "force-dynamic";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created } from "@/lib/api-helpers";
import { badRequest } from "@/lib/errors";
import { UuidSchema, badZod } from "@/lib/validation";
import { parsePagination, paginated } from "@/lib/pagination";
import {
  withAuth,
  resolveContext,
  assertPropertyAccess,
  assertUnitAccess,
  requireCapability,
  getPropertyIdsForContext,
  type UserContext,
} from "@/lib/auth/scope";
import { upsertCommissionExpense } from "@/lib/services/finance-service";
import { paymentMethodSchema } from "@/lib/validation/payments";

/**
 * Revenues collection routes — scoped via @/lib/auth/scope.
 *
 * GET: lists revenues visible to the context (admin = all, owner = own
 * properties, office = office_property_links/legacy fallback). Optional
 * property_id (assertPropertyAccess first), date_from/date_to (+ startDate/
 * endDate aliases) and page/limit/search params.
 *
 * POST: `finance_mutate` capability, positive amount, optional property/unit
 * links (asserted via scope), auto-upserts the commission expense via
 * upsertCommissionExpense (same as the legacy finance-service flow).
 *
 * Response shapes are preserved from the legacy route (unwrapped array /
 * paginated object for GET, the created entity for POST).
 */

const RevenueCreateSchema = z
  .object({
    amount: z.number().positive().optional(),
    amount_sar: z.number().positive().optional(),
    property_id: UuidSchema.optional().nullable(),
    unit_id: UuidSchema.optional().nullable(),
    contact_id: UuidSchema.optional().nullable(),
    // related_revenue_id lives on expenses (commission link), not revenues —
    // accepted for API compatibility but not persisted here.
    related_revenue_id: UuidSchema.optional().nullable(),
    type: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    payment_method: paymentMethodSchema.optional().nullable(),
    received_at: z.string().optional().nullable(),
  })
  .refine((b) => b.amount !== undefined || b.amount_sar !== undefined, {
    message: "المبلغ مطلوب",
  });

export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx, req) => {
    const ds = await getDataSource();
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("property_id");
    const dateFrom = url.searchParams.get("date_from") ?? url.searchParams.get("startDate");
    const dateTo = url.searchParams.get("date_to") ?? url.searchParams.get("endDate");
    const page = parsePagination(url.searchParams);

    if (propertyId) await assertPropertyAccess(ctx, propertyId);

    const ids = await getPropertyIdsForContext(ctx);
    let qb = ds
      .getRepository("Revenue")
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.contact", "contact")
      .leftJoinAndSelect("r.unit", "unit")
      .orderBy("r.created_at", "DESC")
      .andWhere("r.deleted_at IS NULL");

    if (ids !== null) {
      if (ids.length === 0) {
        return page
          ? ok(paginated({ items: [], total: 0, page: page.page, limit: page.limit }))
          : ok([]);
      }
      qb = qb.where("r.property_id IN (:...ids)", { ids });
    }
    if (propertyId) qb = qb.andWhere("r.property_id = :propertyId", { propertyId });
    if (dateFrom) qb = qb.andWhere("r.received_at >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("r.received_at <= :dateTo", { dateTo });

    if (!page) return ok(await qb.getMany());
    const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
    return ok(paginated({ items, total, page: page.page, limit: page.limit, search: page.search }));
  }
);

export const POST = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireCapability(ctx, "finance_mutate");
    return ctx;
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("البيانات مطلوبة");

    const parsed = RevenueCreateSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));
    const data = parsed.data;

    let propertyId = data.property_id != null ? String(data.property_id) : null;
    if (data.unit_id != null) {
      const unitCtx = await assertUnitAccess(ctx, String(data.unit_id));
      propertyId = unitCtx.propertyId;
    } else if (propertyId) {
      await assertPropertyAccess(ctx, propertyId);
    }

    const ds = await getDataSource();
    let ownerId = String(ctx.userId);
    if (propertyId) {
      const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
      if (!prop) throw badRequest("العقار غير موجود");
      ownerId = String((prop as any).owner_id);
    }

    const repo = ds.getRepository("Revenue");
    const revenue = repo.create({
      owner_id: ownerId,
      property_id: propertyId,
      unit_id: data.unit_id != null ? String(data.unit_id) : null,
      contact_id: data.contact_id != null ? String(data.contact_id) : null,
      type: data.type ?? null,
      amount_sar: Number(data.amount_sar ?? data.amount),
      payment_method: data.payment_method ?? "cash",
      received_at: data.received_at ?? new Date().toISOString(),
      description: data.description ?? null,
    } as any);
    await repo.save(revenue);
    await upsertCommissionExpense(ds, revenue);
    return created(revenue);
  }
);