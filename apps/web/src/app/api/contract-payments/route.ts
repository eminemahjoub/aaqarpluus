import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessiblePropertyIds } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contract_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // Join through contracts to ensure ownership
    let qb = ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "Contract",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .orderBy("cp.due_date", "ASC");

    if (contractId) qb = qb.andWhere("cp.contract_id = :contractId", { contractId });
    if (status === "paid") qb = qb.andWhere("cp.status = 'paid'");
    if (status === "pending") qb = qb.andWhere("cp.status != 'paid'");
    if (dateFrom) qb = qb.andWhere("cp.due_date >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("cp.due_date <= :dateTo", { dateTo });

    const payments = await qb.getMany();
    return ok(payments);
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

    // Support batch insert (array), { batch: [...] }, or single
    const items = Array.isArray(body) ? body : Array.isArray(body?.batch) ? body.batch : [body];
    if (items.length === 0) return badRequest("البيانات مطلوبة");

    const repo = ds.getRepository("ContractPayment");
    const saved = [];

    for (const item of items) {
      if (!item.contract_id) continue;
      const payment = repo.create({
        contract_id: item.contract_id,
        amount_sar: Number(item.amount_sar) || 0,
        due_date: item.due_date ?? null,
        paid_at: item.paid_at ?? null,
        status: item.status ?? "pending",
        notes: item.notes ?? null,
      } as any);
      await repo.save(payment);
      saved.push(payment);
    }

    return created(saved.length === 1 ? saved[0] : saved);
  } catch (err) {
    return serverError(err);
  }
}
