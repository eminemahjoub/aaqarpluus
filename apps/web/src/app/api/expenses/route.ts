import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const ds = await getDataSource();
    let qb = ds
      .getRepository("Expense")
      .createQueryBuilder("e")
      .where("e.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("e.paid_at", "DESC");

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

    const expense = repo.create({
      owner_id: user.userId,
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
