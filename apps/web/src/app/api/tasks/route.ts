import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { z } from "zod";
import { UuidSchema, badZod } from "@/lib/validation";

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
  if (userType !== "agency") return true; // owner path handled separately
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

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "عنوان المهمة مطلوب"),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  due_date_hijri: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  cost_sar: z.union([z.number(), z.string()]).optional().nullable(),
  type: z.string().optional().nullable(),
  property_id: UuidSchema.optional().nullable(),
  unit_id: UuidSchema.optional().nullable(),
  contact_id: UuidSchema.optional().nullable(),
  tenant_id: UuidSchema.optional().nullable(),
  extra: z.any().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type");

    let qb = ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .leftJoinAndSelect("t.tenant", "tenant")
      .orderBy("t.created_at", "DESC");

    if (typeFilter) {
      qb = qb.andWhere("t.type = :typeFilter", { typeFilter });
    }

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      qb = qb.where("t.property_id IN (:...propertyIds)", { propertyIds }).andWhere("t.deleted_at IS NULL");
    } else {
      qb = qb.where("t.owner_id = :ownerId", { ownerId: user.userId }).andWhere("t.deleted_at IS NULL");
    }

    const tasks = await qb.getMany();
    return ok(tasks);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const raw = await req.json();
    const parsed = CreateTaskSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const body = parsed.data;

    const ds = await getDataSource();
    const repo = ds.getRepository("Task");
    const propertyId = body.property_id ? String(body.property_id) : null;
    if (propertyId) {
      const can = await assertCanAccessProperty(ds, user, propertyId);
      if (!can) return unauthorized();
    }

    let ownerId = String(user.userId);
    if (String(user.userType ?? "") === "agency") {
      if (!propertyId) return badRequest("معرف العقار مطلوب");
      const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as Record<string, unknown> });
      if (!prop) return badRequest("العقار غير موجود");
      ownerId = String((prop as { owner_id?: string }).owner_id);
    }

    const task = repo.create({
      owner_id: ownerId,
      title: body.title.trim(),
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      due_date_hijri: body.due_date_hijri ?? null,
      status: body.status ?? "pending",
      priority: body.priority ?? "medium",
      cost_sar: body.cost_sar != null && String(body.cost_sar).trim() !== "" ? Number(body.cost_sar) : 0,
      type: body.type ?? "task",
      property_id: body.property_id ?? null,
      unit_id: body.unit_id ?? null,
      contact_id: body.contact_id ?? null,
      tenant_id: body.tenant_id ?? null,
      extra: body.extra && typeof body.extra === "object" ? body.extra : null,
    });

    await repo.save(task);

    // Return with relations
    const saved = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .leftJoinAndSelect("t.tenant", "tenant")
      .where("t.id = :id", { id: (task as { id?: string }).id })
      .getOne();

    return created(saved);
  } catch (err) {
    return serverError(err);
  }
}
