import { getDataSource } from "@/lib/db/data-source";

export type LandingCity = { city: string; count: number };

export type LandingStats = {
  agencies: number | null;
  units: number | null;
  occupancy: number | null;
  collectedSar: number | null;
  cities: LandingCity[];
};

const FALLBACK: LandingStats = {
  agencies: null,
  units: null,
  occupancy: null,
  collectedSar: null,
  cities: [],
};

export async function getLandingStats(): Promise<LandingStats> {
  try {
    const ds = await getDataSource();
    const rows = await ds.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND user_type = 'agency')::int AS agencies,
        (SELECT COUNT(*) FROM units WHERE deleted_at IS NULL)::int AS units,
        (SELECT COUNT(*) FROM units WHERE deleted_at IS NULL AND status = 'occupied')::int AS occupied_units,
        (SELECT COALESCE(SUM(amount_sar), 0) FROM revenues WHERE deleted_at IS NULL)::float8 AS collected_sar
    `);
    const r = rows?.[0];
    if (!r) return FALLBACK;

    const citiesRaw = await ds.query(
      `SELECT COALESCE(NULLIF(TRIM(city), ''), 'غير محدد') AS city, COUNT(*)::int AS count
       FROM properties
       WHERE deleted_at IS NULL
       GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'غير محدد')
       ORDER BY count DESC
       LIMIT 8`
    );


    const units = Number(r.units) || 0;
    const occupied = Number(r.occupied_units) || 0;

    return {
      agencies: Number(r.agencies) || 0,
      units,
      occupancy: units > 0 ? Math.round((occupied / units) * 1000) / 10 : 0,
      collectedSar: Number(r.collected_sar) || 0,
      cities: (citiesRaw ?? []).map((c: any) => ({ city: String(c.city), count: Number(c.count) || 0 })),
    };
  } catch {
    return FALLBACK;
  }
}
