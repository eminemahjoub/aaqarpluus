import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

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
      .getRepository("Expense")
      .createQueryBuilder("e")
      .orderBy("e.paid_at", "DESC");

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      qb = qb.where("e.property_id IN (:...propertyIds)", { propertyIds });
    } else {
      qb = qb.where("e.owner_id = :ownerId", { ownerId: user.userId });
    }

    if (propertyId) qb = qb.andWhere("e.property_id = :propertyId", { propertyId });
    if (dateFrom) qb = qb.andWhere("e.paid_at >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("e.paid_at <= :dateTo", { dateTo });

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
    const repo = ds.getRepository("Expense");
    const propertyId = body.property_id ? String(body.property_id) : null;
    if (!propertyId) return unauthorized();
    const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
    if (!can) return unauthorized();

    const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
    if (!prop) return unauthorized();
    const ownerId = String((prop as any).owner_id);

    const expense = repo.create({
      owner_id: ownerId,
      property_id: body.property_id ?? null,
      type: body.type ?? null,
      amount_sar: Number(body.amount_sar) || 0,
      paid_at: body.paid_at ?? new Date().toISOString(),
      description: body.description ?? null,
    } as any);

    await repo.save(expense);
    return created(expense);
  } catch (err) {
    return serverError(err);
  }
}
