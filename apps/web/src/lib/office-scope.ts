import type { DataSource } from "typeorm";

export async function getAccessiblePropertyIds(
  ds: DataSource,
  user: { userId: string; userType?: string; officeId?: string | null }
) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null; // owners are not property-scoped

  const officeId = user.officeId ? String(user.officeId) : null;
  const agencyId = String(user.userId);
  console.log("[office-scope GET] agencyId:", agencyId, "officeId:", officeId);

  if (!officeId) {
    // Agency without office: access properties they own directly,
    // OR properties whose owner was created by this agency
    const rows = await ds.query(
      `SELECT p.id AS property_id
       FROM properties p
       WHERE p.deleted_at IS NULL
         AND (
           p.owner_id = $1
           OR EXISTS (
             SELECT 1 FROM users u
             WHERE u.id = p.owner_id
               AND u.created_by_agency_id = $1
               AND u.deleted_at IS NULL
           )
         )`,
      [agencyId]
    );
    const ids = Array.from(new Set((rows ?? []).map((r: any) => String(r.property_id)).filter(Boolean)));
    console.log("[office-scope GET] ids found:", ids.length, ids);
    return ids;
  }

  const rows = await ds.query("SELECT property_id FROM office_property_links WHERE office_id = $1", [officeId]);
  const ids = Array.from(new Set((rows ?? []).map((r: any) => String(r.property_id)).filter(Boolean)));
  return ids;
}

export async function assertAgencyCanAccessProperty(
  ds: DataSource,
  user: { userId: string; userType?: string; officeId?: string | null },
  propertyId: string
) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return true;

  const officeId = user.officeId ? String(user.officeId) : null;
  const agencyId = String(user.userId);

  if (!officeId) {
    // Agency without office: check if they created the property,
    // own it directly, or if the property's owner was created by this agency
    const rows = await ds.query(
      `SELECT 1 AS ok
       FROM properties p
       WHERE p.id = $1 AND p.deleted_at IS NULL
         AND (
           p.created_by_agency_id = $2
           OR p.owner_id = $2
           OR EXISTS (
             SELECT 1 FROM users u
             WHERE u.id = p.owner_id
               AND u.created_by_agency_id = $2
               AND u.deleted_at IS NULL
           )
         )
       LIMIT 1`,
      [propertyId, agencyId]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  const ok = await ds.query(
    "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
    [officeId, propertyId]
  );
  return Array.isArray(ok) && ok.length > 0;
}

