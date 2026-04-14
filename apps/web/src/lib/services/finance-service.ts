import type { DataSource } from "typeorm";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";
import { badRequest, unauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";

async function upsertCommissionExpense(ds: DataSource, revenue: any) {
  const propertyId = revenue?.property_id ? String(revenue.property_id) : null;
  if (!propertyId) return;

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
  if (!prop) return;

  const managingOfficeId = (prop as any).managing_office_id ? String((prop as any).managing_office_id) : null;
  const percent =
    (prop as any).commission_percent !== null && (prop as any).commission_percent !== undefined
      ? Number((prop as any).commission_percent)
      : 0;
  if (!managingOfficeId || !Number.isFinite(percent) || percent <= 0) return;

  const amountSar = Number(revenue.amount_sar) || 0;
  const commission = Math.round(((amountSar * percent) / 100) * 100) / 100;
  if (!Number.isFinite(commission) || commission <= 0) return;

  const expenseRepo = ds.getRepository("Expense");
  const existing = await expenseRepo.findOne({ where: { related_revenue_id: String(revenue.id) } as any });
  const payload = {
    owner_id: String(revenue.owner_id),
    property_id: propertyId,
    related_revenue_id: String(revenue.id),
    type: "عمولة مكتب",
    amount_sar: commission,
    paid_at: revenue.received_at ?? new Date().toISOString(),
    description: `عمولة ${percent}%`,
  } as any;

  if (existing) await expenseRepo.update((existing as any).id, payload);
  else await expenseRepo.save(expenseRepo.create(payload));
}

export async function listRevenues(args: { ds: DataSource; user: any; reqUrl: string }) {
  const { ds, user, reqUrl } = args;
  const { searchParams } = new URL(reqUrl);
  const propertyId = searchParams.get("property_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const page = parsePagination(searchParams);
  const propertyIds = await getAccessiblePropertyIds(ds, user);

  let qb = ds.getRepository("Revenue").createQueryBuilder("r").orderBy("r.received_at", "DESC");
  qb = qb.andWhere("r.deleted_at IS NULL");
  if (Array.isArray(propertyIds)) {
    if (propertyIds.length === 0) return page ? paginated({ items: [], total: 0, page: page.page, limit: page.limit }) : [];
    qb = qb.where("r.property_id IN (:...propertyIds)", { propertyIds });
  } else {
    qb = qb.where("r.owner_id = :ownerId", { ownerId: user.userId });
  }
  if (propertyId) qb = qb.andWhere("r.property_id = :propertyId", { propertyId });
  if (dateFrom) qb = qb.andWhere("r.received_at >= :dateFrom", { dateFrom });
  if (dateTo) qb = qb.andWhere("r.received_at <= :dateTo", { dateTo });

  if (!page) return await qb.getMany();
  const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
  return paginated({ items, total, page: page.page, limit: page.limit, search: page.search });
}

export async function createRevenue(args: { ds: DataSource; user: any; body: any }) {
  const { ds, user, body } = args;
  const propertyId = body.property_id ? String(body.property_id) : null;
  if (!propertyId) throw badRequest("معرف العقار مطلوب");
  const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
  if (!can) throw unauthorized();

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
  if (!prop) throw badRequest("العقار غير موجود");
  const ownerId = String((prop as any).owner_id);

  const repo = ds.getRepository("Revenue");
  const revenue = repo.create({
    owner_id: ownerId,
    property_id: propertyId,
    contract_id: body.contract_id ?? null,
    type: body.type ?? null,
    amount_sar: Number(body.amount_sar) || 0,
    received_at: body.received_at ?? new Date().toISOString(),
    description: body.description ?? null,
  } as any);
  await repo.save(revenue);
  await upsertCommissionExpense(ds, revenue);
  return revenue;
}

export async function listExpenses(args: { ds: DataSource; user: any; reqUrl: string }) {
  const { ds, user, reqUrl } = args;
  const { searchParams } = new URL(reqUrl);
  const propertyId = searchParams.get("property_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const page = parsePagination(searchParams);
  const propertyIds = await getAccessiblePropertyIds(ds, user);

  let qb = ds.getRepository("Expense").createQueryBuilder("e").orderBy("e.paid_at", "DESC");
  qb = qb.andWhere("e.deleted_at IS NULL");
  if (Array.isArray(propertyIds)) {
    if (propertyIds.length === 0) return page ? paginated({ items: [], total: 0, page: page.page, limit: page.limit }) : [];
    qb = qb.where("e.property_id IN (:...propertyIds)", { propertyIds });
  } else {
    qb = qb.where("e.owner_id = :ownerId", { ownerId: user.userId });
  }
  if (propertyId) qb = qb.andWhere("e.property_id = :propertyId", { propertyId });
  if (dateFrom) qb = qb.andWhere("e.paid_at >= :dateFrom", { dateFrom });
  if (dateTo) qb = qb.andWhere("e.paid_at <= :dateTo", { dateTo });

  if (!page) return await qb.getMany();
  const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
  return paginated({ items, total, page: page.page, limit: page.limit, search: page.search });
}

export async function createExpense(args: { ds: DataSource; user: any; body: any }) {
  const { ds, user, body } = args;
  const propertyId = body.property_id ? String(body.property_id) : null;
  if (!propertyId) throw badRequest("معرف العقار مطلوب");
  const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
  if (!can) throw unauthorized();

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
  if (!prop) throw badRequest("العقار غير موجود");
  const ownerId = String((prop as any).owner_id);

  const repo = ds.getRepository("Expense");
  const expense = repo.create({
    owner_id: ownerId,
    property_id: propertyId,
    type: body.type ?? null,
    amount_sar: Number(body.amount_sar) || 0,
    paid_at: body.paid_at ?? new Date().toISOString(),
    description: body.description ?? null,
  } as any);
  await repo.save(expense);
  return expense;
}

