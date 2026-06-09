import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

async function assertCanAccessExpense(ds: any, user: any, expenseId: string) {
  const userType = String(user.userType ?? "");
  const repo = ds.getRepository("Expense");
  const exp = await repo.findOne({ where: { id: expenseId } as any });
  if (!exp) return false;
  if (userType !== "agency") {
    return String((exp as any).owner_id) === String(user.userId);
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const pid = String((exp as any).property_id ?? "");
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();

    if (!(await assertCanAccessExpense(ds, user, id))) return unauthorized();
    await ds.getRepository("Expense").delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
