import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { handleError } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    await assertSuperAdmin(req);
    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);
    const page = parsePagination(searchParams) ?? { page: 1, limit: 25, offset: 0, search: null };
    const search = page.search ?? null;
    const status = searchParams.get("status"); // active|inactive

    const params: any[] = [];
    let idx = 1;
    let where = "WHERE o.deleted_at IS NULL";
    if (status === "active") where += " AND o.is_active = true";
    if (status === "inactive") where += " AND o.is_active = false";
    if (search) {
      where += ` AND (o.name ILIKE $${idx} OR o.email ILIKE $${idx} OR o.phone ILIKE $${idx} OR o.license ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const totalRows = await ds.query(`SELECT COUNT(*)::int AS total FROM offices o ${where}`, params);
    const total = Number(totalRows?.[0]?.total ?? 0) || 0;

    params.push(page.limit, page.offset);
    const rows = await ds.query(
      `
      SELECT
        o.id, o.name, o.phone, o.email, o.address, o.license, o.is_active, o.created_at,
        COALESCE(owners.c, 0)::int AS owners_count,
        COALESCE(props.c, 0)::int AS properties_count
      FROM offices o
      LEFT JOIN (
        SELECT office_id, COUNT(*)::int AS c
        FROM office_owner_links
        GROUP BY office_id
      ) owners ON owners.office_id = o.id
      LEFT JOIN (
        SELECT office_id, COUNT(*)::int AS c
        FROM office_property_links
        GROUP BY office_id
      ) props ON props.office_id = o.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      params
    );

    return ok(paginated({ items: rows ?? [], total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
  }
}

