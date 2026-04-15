import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { handleError } from "@/lib/errors";
import { assertSuperAdmin } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  try {
    const me = await assertSuperAdmin(req);
    const ds = await getDataSource();

    const usersRaw = await ds.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE user_type = 'owner')::int AS owners,
        COUNT(*) FILTER (WHERE user_type = 'agency')::int AS agencies,
        COUNT(*) FILTER (WHERE user_type = 'superadmin')::int AS superadmins
      FROM users
      WHERE deleted_at IS NULL`
    );
    const users = usersRaw?.[0] ?? { total: 0, owners: 0, agencies: 0, superadmins: 0 };

    const propertiesRaw = await ds.query(`SELECT COUNT(*)::int AS total FROM properties WHERE deleted_at IS NULL`);
    const unitsRaw = await ds.query(`SELECT COUNT(*)::int AS total FROM units WHERE deleted_at IS NULL`);
    const contractsRaw = await ds.query(
      `SELECT COUNT(*)::int AS active FROM contracts WHERE deleted_at IS NULL AND status = 'active'`
    );

    const recentUsers = await ds.query(
      `SELECT id, full_name, email, phone, user_type, created_at
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 10`
    );

    const recentAudit = await ds.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.email AS user_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );

    const userDistribution = await ds.query(
      `SELECT user_type AS role, COUNT(*)::int AS count
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY user_type
       ORDER BY count DESC`
    );

    const userGrowth12m = await ds.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM users
       WHERE deleted_at IS NULL
         AND created_at >= (NOW() - INTERVAL '12 months')
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    );

    const propertiesByCity = await ds.query(
      `SELECT COALESCE(NULLIF(TRIM(city), ''), '—') AS city, COUNT(*)::int AS count
       FROM properties
       WHERE deleted_at IS NULL
       GROUP BY COALESCE(NULLIF(TRIM(city), ''), '—')
       ORDER BY count DESC
       LIMIT 10`
    );

    return ok({
      users: {
        total: Number(users.total) || 0,
        owners: Number(users.owners) || 0,
        agencies: Number(users.agencies) || 0,
        superadmins: Number(users.superadmins) || 0,
      },
      properties: { total: Number(propertiesRaw?.[0]?.total) || 0 },
      units: { total: Number(unitsRaw?.[0]?.total) || 0 },
      contracts: { active: Number(contractsRaw?.[0]?.active) || 0 },
      recentUsers: recentUsers ?? [],
      recentAudit: recentAudit ?? [],
      charts: {
        userGrowth12m: (userGrowth12m ?? []).map((r: any) => ({ month: String(r.month), count: Number(r.count) || 0 })),
        propertiesByCity: (propertiesByCity ?? []).map((r: any) => ({ city: String(r.city ?? "—"), count: Number(r.count) || 0 })),
        userDistribution: (userDistribution ?? []).map((r: any) => ({ role: String(r.role), count: Number(r.count) || 0 })),
      },
      meta: { requestedBy: (me as any).userId },
    });
  } catch (err) {
    return handleError(err);
  }
}

