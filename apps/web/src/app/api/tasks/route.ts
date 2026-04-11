import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const tasks = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .where("t.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("t.created_at", "DESC")
      .getMany();

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

    const task = repo.create({
      owner_id: user.userId,
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
