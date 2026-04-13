import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest, created } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    if (!officeId) return badRequest("office_id غير موجود");

    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT l.id AS link_id, u.id AS owner_id, u.full_name, u.email, u.phone
       FROM office_owner_links l
       JOIN users u ON u.id = l.owner_id
       WHERE l.office_id = $1
       ORDER BY l.created_at DESC`,
      [officeId]
    );
    return ok(rows);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    if (!officeId) return badRequest("office_id غير موجود");

    const body = await req.json();
    const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
    if (!ownerEmail) return badRequest("إيميل المالك مطلوب");

    const ds = await getDataSource();
    const owner = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.email = :email", { email: ownerEmail })
      .andWhere("u.user_type = 'owner'")
      .getOne();
    if (!owner) return badRequest("لم يتم العثور على مالك بهذا الإيميل");

    const ownerId = String((owner as any).id);
    const exists = await ds.query(
      "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
      [officeId, ownerId]
    );
    if (Array.isArray(exists) && exists.length > 0) return ok({ success: true, alreadyLinked: true });

    const linkRepo = ds.getRepository("OfficeOwnerLink");
    const link = linkRepo.create({ office_id: officeId, owner_id: ownerId } as any);
    await linkRepo.save(link);
    return created({ id: (link as any).id, office_id: officeId, owner_id: ownerId });
  } catch (err) {
    return serverError(err);
  }
}

