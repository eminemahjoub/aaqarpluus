import type { DataSource } from "typeorm";

export async function getAccessiblePropertyIds(
  ds: DataSource,
  user: { userId: string; userType?: string; officeId?: string | null }
) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null; // owners are not property-scoped

  const officeId = user.officeId ? String(user.officeId) : null;
  if (!officeId) return [];

  const rows = await ds.query("SELECT property_id FROM office_property_links WHERE office_id = $1", [officeId]);
  const ids = Array.from(new Set((rows ?? []).map((r: any) => String(r.property_id)).filter(Boolean)));
  return ids;
}

export async function assertAgencyCanAccessProperty(
  ds: DataSource,
  user: { userType?: string; officeId?: string | null },
  propertyId: string
) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return true;

  const officeId = user.officeId ? String(user.officeId) : null;
  if (!officeId) return false;

  const ok = await ds.query(
    "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
    [officeId, propertyId]
  );
  return Array.isArray(ok) && ok.length > 0;
}

