import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessibleOwnerIds, assertAgencyCanAccessOwner } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");

    const ds = await getDataSource();
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return ok([]);
    let qb = ds
      .getRepository("Unit")
      .createQueryBuilder("u")
      .where("u.owner_id IN (:...ownerIds)", { ownerIds })
      .orderBy("u.created_at", "ASC");

    if (propertyId) qb = qb.andWhere("u.property_id = :propertyId", { propertyId });

    const units = await qb.getMany();
    return ok(units);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    if (!body.property_id) return badRequest("معرف العقار مطلوب");
    if (!body.label?.trim()) return badRequest("تسمية الوحدة مطلوبة");

    const ds = await getDataSource();
    const repo = ds.getRepository("Unit");
    const ownerId = String(body.owner_id ?? user.userId);
    const can = await assertAgencyCanAccessOwner(ds, user, ownerId);
    if (!can) return unauthorized();

    const unit = repo.create({
      owner_id: ownerId,
      property_id: body.property_id,
      label: body.label.trim(),
      unit_type: body.unit_type ?? null,
      floor: body.floor ?? null,
      area_sqm: body.area_sqm ? Number(body.area_sqm) : body.area_m2 ? Number(body.area_m2) : null,
      rent_amount: body.rent_amount ? Number(body.rent_amount) : null,
      status: body.status ?? "vacant",
      description: body.description ?? null,
    } as any);

    await repo.save(unit);
    return created(unit);
  } catch (err) {
    return serverError(err);
  }
}
