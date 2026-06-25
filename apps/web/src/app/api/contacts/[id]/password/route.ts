import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
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
      const linked = await ds.query(
        "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
        [officeId, contactOwnerId]
      );
      if (Array.isArray(linked) && linked.length > 0) return contact;
    }
    if (contactOwnerId === agencyId) return contact;
    const rows = await ds.query(
      "SELECT 1 AS ok FROM users WHERE id = $1 AND created_by_agency_id = $2 AND deleted_at IS NULL LIMIT 1",
      [contactOwnerId, agencyId]
    );
    if (Array.isArray(rows) && rows.length > 0) return contact;
    return null;
  }

  return null;
}

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || String(user.userType ?? "") !== "agency") return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");

    const contact = await assertCanAccessContact(ds, user, id);
    if (!contact) return unauthorized();

    const plainPassword = generatePassword();
    const hash = await bcrypt.hash(plainPassword, 10);

    await repo.update(id, { pin_hash: hash } as any);

    return ok({ password: plainPassword });
  } catch (err) {
    return serverError(err);
  }
}
