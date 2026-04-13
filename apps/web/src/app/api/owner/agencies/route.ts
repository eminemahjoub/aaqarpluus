import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";

function normalizeSaudiPhone(raw: string) {
  const s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  if (/^05\d{8}$/.test(s)) return `+966${s.substring(1)}`;
  if (/^\+9665\d{8}$/.test(s)) return s;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType ?? "") !== "owner") return unauthorized();

    const ds = await getDataSource();
    const ownerId = String(user.userId);

    const rows = await ds.query(
      `
      SELECT
        ool.office_id,
        o.name AS office_name,
        u.full_name AS office_contact_name,
        u.email AS office_email,
        u.phone AS office_phone,
        COALESCE((
          SELECT COUNT(*)::int
          FROM office_property_links opl
          WHERE opl.owner_id = ool.owner_id AND opl.office_id = ool.office_id
        ), 0) AS properties_count
      FROM office_owner_links ool
      JOIN offices o ON o.id = ool.office_id
      LEFT JOIN LATERAL (
        SELECT uu.full_name, uu.email, uu.phone
        FROM users uu
        WHERE uu.office_id = ool.office_id AND uu.user_type = 'agency'
        ORDER BY uu.created_at ASC
        LIMIT 1
      ) u ON TRUE
      WHERE ool.owner_id = $1
      ORDER BY o.name ASC
      `,
      [ownerId]
    );

    return ok(
      (rows ?? []).map((r: any) => ({
        officeId: String(r.office_id),
        officeName: String(r.office_name ?? "—"),
        officeContactName: r.office_contact_name ? String(r.office_contact_name) : null,
        officeEmail: r.office_email ? String(r.office_email) : null,
        officePhone: r.office_phone ? String(r.office_phone) : null,
        propertiesCount: Number(r.properties_count) || 0,
      }))
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType ?? "") !== "owner") return unauthorized();

    const body = await req.json();
    const phone = normalizeSaudiPhone(body.agencyPhone);
    if (!phone) return badRequest("رقم جوال المكتب غير صحيح");

    const ds = await getDataSource();
    const ownerId = String(user.userId);

    const agencyUser = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.phone = :phone", { phone })
      .andWhere("u.user_type = 'agency'")
      .getOne();
    if (!agencyUser) return badRequest("لم يتم العثور على مكتب بهذا الرقم");

    const officeId = (agencyUser as any).office_id ? String((agencyUser as any).office_id) : null;
    if (!officeId) return badRequest("هذا المكتب غير مرتبط بـ office_id");

    // Create (or keep) the owner↔office link (agency list for the owner)
    await ds.query(
      `
      INSERT INTO office_owner_links (office_id, owner_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
      `,
      [officeId, ownerId]
    );

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType ?? "") !== "owner") return unauthorized();

    const { searchParams } = new URL(req.url);
    const officeId = String(searchParams.get("office_id") ?? "").trim();
    const propertyId = String(searchParams.get("property_id") ?? "").trim();
    if (!officeId) return badRequest("office_id مطلوب");

    const ds = await getDataSource();
    const ownerId = String(user.userId);

    // For backward compatibility: if property_id provided, remove only that property assignment.
    if (propertyId) {
      await ds.query(
        `DELETE FROM office_property_links WHERE owner_id = $1 AND office_id = $2 AND property_id = $3`,
        [ownerId, officeId, propertyId]
      );
      await ds.query(
        `UPDATE properties SET managing_office_id = NULL WHERE owner_id = $1 AND id = $2 AND managing_office_id = $3`,
        [ownerId, propertyId, officeId]
      );
      return ok({ success: true });
    }

    // Delete the agency from the owner's list, and remove any existing assignments too.
    await ds.query(`DELETE FROM office_owner_links WHERE owner_id = $1 AND office_id = $2`, [ownerId, officeId]);
    await ds.query(`DELETE FROM office_property_links WHERE owner_id = $1 AND office_id = $2`, [ownerId, officeId]);
    await ds.query(`UPDATE properties SET managing_office_id = NULL WHERE owner_id = $1 AND managing_office_id = $2`, [ownerId, officeId]);

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

