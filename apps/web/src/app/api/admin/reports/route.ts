export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await assertSuperAdmin(req);
    const ds = await getDataSource();

    const usersGrowth = await ds.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM users
       WHERE deleted_at IS NULL AND created_at >= (NOW() - INTERVAL '12 months')
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    );

    const propertiesGrowth = await ds.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM properties
       WHERE deleted_at IS NULL AND created_at >= (NOW() - INTERVAL '12 months')
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    );

    const topCities = await ds.query(
      `SELECT COALESCE(NULLIF(TRIM(city), ''), '—') AS city, COUNT(*)::int AS count
       FROM properties
       WHERE deleted_at IS NULL
       GROUP BY COALESCE(NULLIF(TRIM(city), ''), '—')
       ORDER BY count DESC
       LIMIT 10`
    );

    const topOwners = await ds.query(
      `SELECT u.id AS owner_id, u.full_name, u.email, COUNT(p.id)::int AS properties_count
       FROM users u
       JOIN properties p ON p.owner_id = u.id AND p.deleted_at IS NULL
       WHERE u.deleted_at IS NULL AND u.user_type = 'owner'
       GROUP BY u.id, u.full_name, u.email
       ORDER BY properties_count DESC
       LIMIT 10`
    );

    const revenueRaw = await ds.query(`SELECT COALESCE(SUM(amount_sar), 0)::numeric AS revenue FROM revenues WHERE deleted_at IS NULL`);

    const occupancyRaw = await ds.query(
      `SELECT
        COUNT(*)::int AS total_units,
        COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied_units
       FROM units
       WHERE deleted_at IS NULL`
    );
    const totalUnits = Number(occupancyRaw?.[0]?.total_units ?? 0) || 0;
    const occupiedUnits = Number(occupancyRaw?.[0]?.occupied_units ?? 0) || 0;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0;

    return ok({
      usersGrowth: usersGrowth ?? [],
      propertiesGrowth: propertiesGrowth ?? [],
      topCities: topCities ?? [],
      topOwners: topOwners ?? [],
      totalRevenueSar: Number(revenueRaw?.[0]?.revenue ?? 0) || 0,
      occupancy: { totalUnits, occupiedUnits, occupancyRatePercent: occupancyRate },
    });
  } catch (err) {
    return handleError(err);
  }
}

