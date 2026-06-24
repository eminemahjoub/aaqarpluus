import type { DataSource } from "typeorm";
import { badRequest, unauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";

async function getAccessiblePropertyIds(ds: DataSource, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null;
  const agencyId = String(user.userId);
  const rows = await ds.query(
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
  const ids: string[] = Array.from(new Set((rows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
  return ids.length > 0 ? ids : [];
}

async function assertCanAccessProperty(ds: DataSource, user: any, propertyId: string) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return true;
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  if (officeId) {
    const linked = await ds.query(
      "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
      [officeId, propertyId]
    );
    if (Array.isArray(linked) && linked.length > 0) return true;
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
    [propertyId, agencyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function upsertCommissionExpense(ds: DataSource, revenue: any) {
  const propertyId = revenue?.property_id ? String(revenue.property_id) : null;
  if (!propertyId) return;

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as Record<string, unknown> });
  if (!prop) return;

  const propData = prop as { managing_office_id?: string; commission_percent?: number | null };
  const managingOfficeId = propData.managing_office_id ? String(propData.managing_office_id) : null;
  const percent =
    propData.commission_percent !== null && propData.commission_percent !== undefined
      ? Number(propData.commission_percent)
      : 0;
  if (!managingOfficeId || !Number.isFinite(percent) || percent <= 0) return;

  const amountSar = Number(revenue.amount_sar) || 0;
  const commission = Math.round(((amountSar * percent) / 100) * 100) / 100;
  if (!Number.isFinite(commission) || commission <= 0) return;

  const expenseRepo = ds.getRepository("Expense");
  const existing = await expenseRepo.findOne({ where: { related_revenue_id: String(revenue.id) } as Record<string, unknown> });
  const payload = {
    owner_id: String(revenue.owner_id),
    property_id: propertyId,
    related_revenue_id: String(revenue.id),
    type: "عمولة مكتب",
    amount_sar: commission,
    paid_at: revenue.received_at ?? new Date().toISOString(),
    description: `عمولة ${percent}%`,
  };

  if (existing) {
    const existingId = (existing as { id?: string }).id;
    if (existingId) await expenseRepo.update(existingId, payload);
  } else await expenseRepo.save(expenseRepo.create(payload));
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
  const can = await assertCanAccessProperty(ds, user, propertyId);
  if (!can) throw unauthorized();

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as Record<string, unknown> });
  if (!prop) throw badRequest("العقار غير موجود");
  const ownerId = String((prop as { owner_id?: string }).owner_id);

  const repo = ds.getRepository("Revenue");
  const revenue = repo.create({
    owner_id: ownerId,
    property_id: propertyId,
    unit_id: body.unit_id ?? null,
    contract_id: body.contract_id ?? null,
    contact_id: body.contact_id ?? null,
    type: body.type ?? null,
    amount_sar: Number(body.amount_sar) || 0,
    payment_method: body.payment_method ?? null,
    received_at: body.received_at ?? new Date().toISOString(),
    description: body.description ?? null,
  });
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
  const can = await assertCanAccessProperty(ds, user, propertyId);
  if (!can) throw unauthorized();

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as Record<string, unknown> });
  if (!prop) throw badRequest("العقار غير موجود");
  const ownerId = String((prop as { owner_id?: string }).owner_id);

  const repo = ds.getRepository("Expense");
  const expense = repo.create({
    owner_id: ownerId,
    property_id: propertyId,
    unit_id: body.unit_id ?? null,
    contact_id: body.contact_id ?? null,
    type: body.type ?? null,
    amount_sar: Number(body.amount_sar) || 0,
    payment_method: body.payment_method ?? null,
    paid_at: body.paid_at ?? new Date().toISOString(),
    description: body.description ?? null,
  });
  await repo.save(expense);
  return expense;
}

