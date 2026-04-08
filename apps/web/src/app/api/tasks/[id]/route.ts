import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Task");

    const task = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!task) return unauthorized();

    const updates: Record<string, any> = {};
    const fields = ["title", "description", "due_date", "due_date_hijri", "status", "priority", "cost_sar", "property_id", "unit_id", "contact_id"];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    await repo.update(id, updates);

    const updated = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .leftJoinAndSelect("t.contact", "contact")
      .where("t.id = :id", { id })
      .getOne();

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Task");

    const task = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!task) return unauthorized();

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
