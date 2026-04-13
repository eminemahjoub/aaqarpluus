import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const tasks = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .orderBy("t.created_at", "DESC")
      .getMany();

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      const filtered = (tasks ?? []).filter((t: any) => {
        const pid = String(t.property_id ?? t.property?.id ?? "");
        return !pid ? false : propertyIds.includes(pid);
      });
      return ok(filtered);
    }

    return ok(tasks);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    if (!body.title?.trim()) return badRequest("عنوان المهمة مطلوب");

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
      cost_sar: body.cost_sar ?? 0,
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
