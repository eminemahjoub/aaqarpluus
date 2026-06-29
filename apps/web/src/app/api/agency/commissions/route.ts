export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null;
  const agencyId = String(user.userId);
  const rows = await ds.query(
    `SELECT id FROM properties
     WHERE deleted_at IS NULL
       AND (created_by_agency_id = $1 OR owner_id = $1 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = owner_id
           AND u.created_by_agency_id = $1
           AND u.deleted_at IS NULL
       ))`,
    [agencyId]
  );
  const ids: string[] = Array.from(new Set((rows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
  return ids.length > 0 ? ids : [];
}

function ymdMonth(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType ?? "") !== "agency") return unauthorized();

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return ok({
        month: ymdMonth(new Date()),
        monthCommissionSar: 0,
        year: new Date().getFullYear(),
        yearCommissionSar: 0,
        totalCommissionSar: 0,
        byMonth: [],
      });
    }

    const officeRow = await ds.query(`SELECT office_id FROM users WHERE id = $1 LIMIT 1`, [String(user.userId)]);
    const officeId = officeRow?.[0]?.office_id ? String(officeRow[0].office_id) : null;
    if (!officeId) {
      return ok({
        month: ymdMonth(new Date()),
        monthCommissionSar: 0,
        year: new Date().getFullYear(),
        yearCommissionSar: 0,
        totalCommissionSar: 0,
        byMonth: [],
      });
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year") ?? String(new Date().getFullYear()));
    const month = String(searchParams.get("month") ?? ymdMonth(new Date())); // YYYY-MM
    const monthStart = `${month}-01`;
    const propertyId = String(searchParams.get("property_id") ?? "").trim();
    const targetPropertyIds = propertyId && propertyIds.includes(propertyId) ? [propertyId] : propertyIds;

    const totals = await ds.query(
      `
      SELECT
        COALESCE(SUM(e.amount_sar), 0) AS total_sar
      FROM expenses e
      JOIN properties p ON p.id = e.property_id
      WHERE e.type = 'عمولة مكتب'
        AND p.managing_office_id = $1
        AND e.property_id = ANY($2)
      `,
      [officeId, targetPropertyIds]
    );
    const totalCommissionSar = Number(totals?.[0]?.total_sar) || 0;

    const yearRows = await ds.query(
      `
      SELECT
        COALESCE(SUM(e.amount_sar), 0) AS year_sar
      FROM expenses e
      JOIN properties p ON p.id = e.property_id
      WHERE e.type = 'عمولة مكتب'
        AND p.managing_office_id = $1
        AND e.property_id = ANY($2)
        AND EXTRACT(YEAR FROM e.paid_at) = $3
      `,
      [officeId, targetPropertyIds, year]
    );
    const yearCommissionSar = Number(yearRows?.[0]?.year_sar) || 0;

    const monthRows = await ds.query(
      `
      SELECT
        COALESCE(SUM(e.amount_sar), 0) AS month_sar
      FROM expenses e
      JOIN properties p ON p.id = e.property_id
      WHERE e.type = 'عمولة مكتب'
        AND p.managing_office_id = $1
        AND e.property_id = ANY($2)
        AND DATE_TRUNC('month', e.paid_at) = DATE_TRUNC('month', $3::date)
      `,
      [officeId, targetPropertyIds, monthStart]
    );
    const monthCommissionSar = Number(monthRows?.[0]?.month_sar) || 0;

    const byMonth = await ds.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', e.paid_at), 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount_sar), 0) AS amount_sar
      FROM expenses e
      JOIN properties p ON p.id = e.property_id
      WHERE e.type = 'عمولة مكتب'
        AND p.managing_office_id = $1
        AND e.property_id = ANY($2)
        AND EXTRACT(YEAR FROM e.paid_at) = $3
      GROUP BY DATE_TRUNC('month', e.paid_at)
      ORDER BY DATE_TRUNC('month', e.paid_at) ASC
      `,
      [officeId, targetPropertyIds, year]
    );

    return ok({
      month,
      monthCommissionSar,
      year,
      yearCommissionSar,
      totalCommissionSar,
      byMonth: (byMonth ?? []).map((r: any) => ({
        month: String(r.month),
        amountSar: Number(r.amount_sar) || 0,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}

