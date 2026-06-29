export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

async function assertCanAccessTask(ds: any, user: any, taskId: string) {
  const userType = String(user.userType ?? "");
  const repo = ds.getRepository("Task");
  const task = await repo.findOne({ where: { id: taskId } as Record<string, unknown> });
  if (!task) return false;
  const typedTask = task as { owner_id?: string; property_id?: string };
  if (userType !== "agency") {
    return String(typedTask.owner_id) === String(user.userId);
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const pid = String(typedTask.property_id ?? "");
  if (!pid) return false;
  if (officeId) {
    const linked = await ds.query(
      "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
      [officeId, pid]
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
    [pid, agencyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Task");

    const task = await repo.findOne({ where: { id } as Record<string, unknown> });
    if (!task) return unauthorized();
    if (!(await assertCanAccessTask(ds, user, id))) return unauthorized();

    const updates: Record<string, any> = {};
    const fields = [
      "title",
      "description",
      "due_date",
      "due_date_hijri",
      "status",
      "priority",
      "cost_sar",
      "type",
      "property_id",
      "unit_id",
      "contact_id",
      "tenant_id",
      "extra",
    ];
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
      .leftJoinAndSelect("t.tenant", "tenant")
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

    const task = await repo.findOne({ where: { id } as Record<string, unknown> });
    if (!task) return unauthorized();
    if (!(await assertCanAccessTask(ds, user, id))) return unauthorized();

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
