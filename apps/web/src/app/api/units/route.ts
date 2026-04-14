import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";
import { z } from "zod";
import { CommissionPercentSchema, UuidSchema, badZod } from "@/lib/validation";

const CreateUnitSchema = z.object({
  property_id: UuidSchema,
  label: z.string().trim().min(1, "تسمية الوحدة مطلوبة"),
  unit_type: z.string().trim().min(1).optional().nullable(),
  floor: z.union([z.number(), z.string()]).optional().nullable(),
  area_sqm: z.union([z.number(), z.string()]).optional().nullable(),
  area_m2: z.union([z.number(), z.string()]).optional().nullable(),
  rent_amount: z.union([z.number(), z.string()]).optional().nullable(),
  status: z.string().trim().min(1).optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let qb = ds
      .getRepository("Unit")
      .createQueryBuilder("u")
      .orderBy("u.created_at", "ASC");

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      qb = qb.where("u.property_id IN (:...propertyIds)", { propertyIds });
    } else {
      qb = qb.where("u.owner_id = :ownerId", { ownerId: user.userId });
    }

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

    const raw = await req.json();
    const parsed = CreateUnitSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const body = parsed.data;

    const ds = await getDataSource();
    const repo = ds.getRepository("Unit");
    const propertyId = String(body.property_id);
    const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
    if (!can) return unauthorized();

    const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
    if (!prop) return badRequest("العقار غير موجود");
    const ownerId = String((prop as any).owner_id);

    const unit = repo.create({
      owner_id: ownerId,
      property_id: body.property_id,
      label: body.label.trim(),
      unit_type: body.unit_type ?? null,
      floor: body.floor != null && String(body.floor).trim() !== "" ? Number(body.floor) : null,
      area_sqm:
        body.area_sqm != null && String(body.area_sqm).trim() !== ""
          ? Number(body.area_sqm)
          : body.area_m2 != null && String(body.area_m2).trim() !== ""
            ? Number(body.area_m2)
            : null,
      rent_amount: body.rent_amount != null && String(body.rent_amount).trim() !== "" ? Number(body.rent_amount) : null,
      status: (body.status as any) ?? "vacant",
      description: body.description ?? null,
    } as any);

    await repo.save(unit);
    return created(unit);
  } catch (err) {
    return serverError(err);
  }
}
