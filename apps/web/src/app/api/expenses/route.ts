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
import { paymentMethodSchema } from "@/lib/validation/payments";

/**
 * Expenses collection routes — scoped via @/lib/auth/scope.
 *
 * Same pattern as /api/revenues: expenses has no office_id column, so listing
 * scopes through the property chain via getPropertyIdsForContext. Optional
 * property_id (assertPropertyAccess first), date_from/date_to (+ startDate/
 * endDate aliases) filter on paid_at, ordered by created_at DESC.
 *
 * POST persists related_revenue_id (unlike revenues — expenses own that
 * column for commission links) and uses paid_at as the date field.
 */

const ExpenseCreateSchema = z
  .object({
    amount: z.number().positive().optional(),
    amount_sar: z.number().positive().optional(),
    property_id: UuidSchema.optional().nullable(),
    unit_id: UuidSchema.optional().nullable(),
    contact_id: UuidSchema.optional().nullable(),
    related_revenue_id: UuidSchema.optional().nullable(),
    type: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    payment_method: paymentMethodSchema.optional().nullable(),
    paid_at: z.string().optional().nullable(),
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
      .getRepository("Expense")
      .createQueryBuilder("e")
      .leftJoinAndSelect("e.contact", "contact")
      .leftJoinAndSelect("e.unit", "unit")
      .orderBy("e.created_at", "DESC")
      .andWhere("e.deleted_at IS NULL");

    if (ids !== null) {
      if (ids.length === 0) {
        return page
          ? ok(paginated({ items: [], total: 0, page: page.page, limit: page.limit }))
          : ok([]);
      }
      qb = qb.where("e.property_id IN (:...ids)", { ids });
    }
    if (propertyId) qb = qb.andWhere("e.property_id = :propertyId", { propertyId });
    if (dateFrom) qb = qb.andWhere("e.paid_at >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("e.paid_at <= :dateTo", { dateTo });

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

    const parsed = ExpenseCreateSchema.safeParse(body);
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

    const repo = ds.getRepository("Expense");
    const expense = repo.create({
      owner_id: ownerId,
      property_id: propertyId,
      unit_id: data.unit_id != null ? String(data.unit_id) : null,
      contact_id: data.contact_id != null ? String(data.contact_id) : null,
      related_revenue_id: data.related_revenue_id != null ? String(data.related_revenue_id) : null,
      type: data.type ?? null,
      amount_sar: Number(data.amount_sar ?? data.amount),
      payment_method: data.payment_method ?? "cash",
      paid_at: data.paid_at ?? new Date().toISOString(),
      description: data.description ?? null,
    } as any);
    await repo.save(expense);
    return created(expense);
  }
);