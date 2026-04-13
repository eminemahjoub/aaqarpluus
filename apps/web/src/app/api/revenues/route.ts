import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

async function upsertCommissionExpense(ds: any, revenue: any) {
  const propertyId = revenue?.property_id ? String(revenue.property_id) : null;
  if (!propertyId) return;

  const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
  if (!prop) return;

  const managingOfficeId = (prop as any).managing_office_id ? String((prop as any).managing_office_id) : null;
  const percent = (prop as any).commission_percent !== null && (prop as any).commission_percent !== undefined
    ? Number((prop as any).commission_percent)
    : 0;
  if (!managingOfficeId || !Number.isFinite(percent) || percent <= 0) return;

  const amountSar = Number(revenue.amount_sar) || 0;
  const commission = Math.round((amountSar * percent / 100) * 100) / 100;
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

  if (existing) {
    await expenseRepo.update((existing as any).id, payload);
  } else {
    await expenseRepo.save(expenseRepo.create(payload));
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let qb = ds
      .getRepository("Revenue")
      .createQueryBuilder("r")
      .orderBy("r.received_at", "DESC");

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      qb = qb.where("r.property_id IN (:...propertyIds)", { propertyIds });
    } else {
      qb = qb.where("r.owner_id = :ownerId", { ownerId: user.userId });
    }

    if (propertyId) qb = qb.andWhere("r.property_id = :propertyId", { propertyId });
    if (dateFrom) qb = qb.andWhere("r.received_at >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("r.received_at <= :dateTo", { dateTo });

    return ok(await qb.getMany());
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
    const repo = ds.getRepository("Revenue");
    const propertyId = body.property_id ? String(body.property_id) : null;
    if (!propertyId) return unauthorized();
    const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
    if (!can) return unauthorized();

    const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
    if (!prop) return unauthorized();
    const ownerId = String((prop as any).owner_id);

    const revenue = repo.create({
      owner_id: ownerId,
      property_id: body.property_id ?? null,
      contract_id: body.contract_id ?? null,
      type: body.type ?? null,
      amount_sar: Number(body.amount_sar) || 0,
      received_at: body.received_at ?? new Date().toISOString(),
      description: body.description ?? null,
    } as any);

    await repo.save(revenue);
    await upsertCommissionExpense(ds, revenue);
    return created(revenue);
  } catch (err) {
    return serverError(err);
  }
}
