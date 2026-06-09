import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";

async function assertCanAccessContact(ds: any, user: any, contactId: string) {
  const userType = String(user.userType ?? "");
  const repo = ds.getRepository("Contact");
  const contact = await repo.findOne({ where: { id: contactId } as any });
  if (!contact) return null;

  if (userType === "agency") {
    const officeId = user.officeId ? String(user.officeId) : null;
    const agencyId = String(user.userId);
    const contactOwnerId = String((contact as any).owner_id);
    if (officeId) {
      // Check via office_owner_links
      const linked = await ds.query(
        "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
        [officeId, contactOwnerId]
      );
      if (Array.isArray(linked) && linked.length > 0) return contact;
    }
    // Agency without office: owner is agency, or owner was created by agency
    if (contactOwnerId === agencyId) return contact;
    const rows = await ds.query(
      "SELECT 1 AS ok FROM users WHERE id = $1 AND created_by_agency_id = $2 AND deleted_at IS NULL LIMIT 1",
      [contactOwnerId, agencyId]
    );
    if (Array.isArray(rows) && rows.length > 0) return contact;
    return null;
  }

  // Owner path
  if (String((contact as any).owner_id) === String(user.userId)) return contact;
  return null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");

    const contact = await assertCanAccessContact(ds, user, id);
    if (!contact) return unauthorized();

    const newType = body.type ?? (contact as any).type;
    const isTenant = newType === "tenant";
    if (body.sex && !["ذكر", "أنثى"].includes(body.sex)) return badRequest("الجنس يجب أن يكون ذكر أو أنثى");

    await repo.update(id, {
      name: body.name ?? (contact as any).name,
      phone: body.phone !== undefined ? body.phone : (contact as any).phone,
      alternative_phone: body.alternative_phone !== undefined ? body.alternative_phone : (contact as any).alternative_phone,
      sex: body.sex !== undefined ? (body.sex?.trim() || null) : (isTenant ? (contact as any).sex : null),
      id_number: body.id_number !== undefined ? (body.id_number?.trim() || null) : (isTenant ? (contact as any).id_number : null),
      type: newType,
      status: body.status ?? (contact as any).status,
    } as any);

    const updated = await repo.findOne({ where: { id } as any });
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
    const repo = ds.getRepository("Contact");

    const contact = await assertCanAccessContact(ds, user, id);
    if (!contact) return unauthorized();

    // Nullify contact references before deleting (avoid FK violations)
    await ds.query(`UPDATE contracts SET contact_id = NULL WHERE contact_id = $1`, [id]);
    await ds.query(`UPDATE tasks SET contact_id = NULL WHERE contact_id = $1`, [id]);

    await repo.update(id, { deleted_at: new Date().toISOString() } as any);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
