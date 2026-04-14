import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";
import { z } from "zod";
import { UuidSchema, badZod } from "@/lib/validation";

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "عنوان المهمة مطلوب"),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  due_date_hijri: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  cost_sar: z.union([z.number(), z.string()]).optional().nullable(),
  property_id: UuidSchema.optional().nullable(),
  unit_id: UuidSchema.optional().nullable(),
  contact_id: UuidSchema.optional().nullable(),
  extra: z.any().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let qb = ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .orderBy("t.created_at", "DESC");

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
      const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
      if (!can) return unauthorized();
    }

    let ownerId = String(user.userId);
    if (String(user.userType ?? "") === "agency") {
      if (!propertyId) return badRequest("معرف العقار مطلوب");
      const prop = await ds.getRepository("Property").findOne({ where: { id: propertyId } as any });
      if (!prop) return badRequest("العقار غير موجود");
      ownerId = String((prop as any).owner_id);
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
      property_id: body.property_id ?? null,
      unit_id: body.unit_id ?? null,
      contact_id: body.contact_id ?? null,
      extra: body.extra && typeof body.extra === "object" ? body.extra : null,
    } as any);

    await repo.save(task);

    // Return with relations
    const saved = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .where("t.id = :id", { id: (task as any).id })
      .getOne();

    return created(saved);
  } catch (err) {
    return serverError(err);
  }
}
