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
    const page = parsePagination(searchParams) ?? { page: 1, limit: 50, offset: 0, search: null };

    const userId = searchParams.get("user_id");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entity_type");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const search = page.search ?? null;

    const params: any[] = [];
    let idx = 1;
    let where = "WHERE 1=1";

    if (userId) {
      where += ` AND a.user_id = $${idx++}`;
      params.push(userId);
    }
    if (action) {
      where += ` AND a.action = $${idx++}`;
      params.push(action);
    }
    if (entityType) {
      where += ` AND a.entity_type = $${idx++}`;
      params.push(entityType);
    }
    if (dateFrom) {
      where += ` AND a.created_at >= $${idx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      where += ` AND a.created_at <= $${idx++}`;
      params.push(dateTo);
    }
    if (search) {
      where += ` AND (u.email ILIKE $${idx} OR a.action ILIKE $${idx} OR a.entity_type ILIKE $${idx} OR a.entity_id ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const totalRows = await ds.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}`,
      params
    );
    const total = Number(totalRows?.[0]?.total ?? 0) || 0;

    params.push(page.limit, page.offset);
    const rows = await ds.query(
      `SELECT
        a.id, a.created_at, a.user_id, u.email AS user_email,
        a.action, a.entity_type, a.entity_id, a.changes, a.metadata, a.ip_address, a.user_agent
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return ok(paginated({ items: rows ?? [], total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
  }
}

