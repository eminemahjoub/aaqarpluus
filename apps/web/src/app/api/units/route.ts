import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { denyIfOwnerCannotMutateProperties } from "@/lib/mutate-guard";
import { z } from "zod";
import { CommissionPercentSchema, UuidSchema, badZod } from "@/lib/validation";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
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

async function assertCanAccessProperty(ds: any, user: any, propertyId: string) {
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
    const readOnly = denyIfOwnerCannotMutateProperties(user);
    if (readOnly) return readOnly;

    const raw = await req.json();
    const parsed = CreateUnitSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const body = parsed.data;

    const ds = await getDataSource();
    const repo = ds.getRepository("Unit");
    const propertyId = String(body.property_id);
    const can = await assertCanAccessProperty(ds, user, propertyId);
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
