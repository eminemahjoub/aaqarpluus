import type { DataSource } from "typeorm";

export async function getAccessibleOwnerIds(ds: DataSource, user: { userId: string; userType?: string; officeId?: string | null }) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return [user.userId];
  const officeId = user.officeId ? String(user.officeId) : null;
  if (!officeId) return [];

  const rows = await ds.query("SELECT owner_id FROM office_owner_links WHERE office_id = $1", [officeId]);
  const ids = Array.from(new Set((rows ?? []).map((r: any) => String(r.owner_id)).filter(Boolean)));
  return ids;
}

export async function assertAgencyCanAccessOwner(ds: DataSource, user: { userType?: string; officeId?: string | null; userId: string }, ownerId: string) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return user.userId === ownerId;
  const officeId = user.officeId ? String(user.officeId) : null;
  if (!officeId) return false;
  const ok = await ds.query(
    "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
    [officeId, ownerId]
  );
  return Array.isArray(ok) && ok.length > 0;
}

