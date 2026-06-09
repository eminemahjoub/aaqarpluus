import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { buildOwnerContractSummary, ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "income";
    const dateFrom = searchParams.get("date_from") ?? searchParams.get("from");
    const dateTo = searchParams.get("date_to") ?? searchParams.get("to");
    const propertyId = searchParams.get("property_id");
    const contactId = searchParams.get("contact_id");
    const status = searchParams.get("payment_status") ?? searchParams.get("status") ?? searchParams.get("contract_status");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    if (Array.isArray(propertyIds) && propertyIds.length === 0) return ok([]);
    const ownerIds = Array.isArray(propertyIds)
      ? Array.from(
          new Set(
            (await ds.query("SELECT DISTINCT owner_id FROM properties WHERE id = ANY($1)", [propertyIds]))
              .map((r: any) => String(r.owner_id))
              .filter(Boolean)
          )
        )
      : [String(user.userId)];

    if (type === "income") {
      const extraPropertyFilter = propertyIds ? "AND r.property_id = ANY($4)" : "";
      const rows = await ds.query(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('month', r.received_at), 'YYYY-MM-01') AS month,
          COALESCE(SUM(r.amount_sar), 0) AS income_sar,
          0 AS expenses_sar,
          COALESCE(SUM(r.amount_sar), 0) AS net_sar
        FROM revenues r
        WHERE r.owner_id = ANY($1)
          ${dateFrom ? "AND r.received_at >= $2" : ""}
          ${dateTo ? `AND r.received_at <= $${dateFrom ? 3 : 2}` : ""}
          ${propertyId ? `AND r.property_id = $${[dateFrom, dateTo, propertyId].filter(Boolean).length}` : ""}
          ${Array.isArray(propertyIds) ? "AND r.property_id = ANY($4)" : ""}
        GROUP BY DATE_TRUNC('month', r.received_at)
        ORDER BY month DESC
        LIMIT 24
        `,
        Array.isArray(propertyIds)
          ? [ownerIds, ...[dateFrom, dateTo, propertyId].filter(Boolean), propertyIds]
          : [ownerIds, ...[dateFrom, dateTo, propertyId].filter(Boolean)]
      );
      return ok(rows);
    }

    if (type === "payments") {
      const params: any[] = [Array.isArray(propertyIds) ? propertyIds : ownerIds];
      let idx = 2;
      let conditions = "";
      if (dateFrom) { conditions += ` AND cp.due_date >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { conditions += ` AND cp.due_date <= $${idx++}`; params.push(dateTo); }
      if (status === "paid") { conditions += ` AND cp.status = 'paid'`; }
      if (status === "pending") { conditions += ` AND cp.status != 'paid'`; }
      if (propertyId) { conditions += ` AND c.property_id = $${idx++}`; params.push(propertyId); }
      if (contactId) { conditions += ` AND c.contact_id = $${idx++}`; params.push(contactId); }

      const rows = await ds.query(
        `
        SELECT
          cp.id, cp.amount_sar, cp.due_date, cp.paid_at, cp.status,
          p.name AS property_name,
          u.label AS unit_label,
          ct.name AS contact_name,
          c.start_date AS contract_start
        FROM contract_payments cp
        JOIN contracts c ON c.id = cp.contract_id
        LEFT JOIN properties p ON p.id = c.property_id
        LEFT JOIN units u ON u.id = c.unit_id
        LEFT JOIN contacts ct ON ct.id = c.contact_id
        WHERE ${
          Array.isArray(propertyIds) ? "c.property_id = ANY($1)" : "c.owner_id = ANY($1)"
        } ${conditions}
        ORDER BY cp.due_date ASC
        LIMIT 2000
        `,
        params
      );
      if (ownerHidesTenantPii(user)) {
        const mapped = (rows as any[]).map((r) => {
          const summary = buildOwnerContractSummary({
            end_date: r.contract_start,
            payments: [{ due_date: r.due_date, amount_sar: r.amount_sar, status: r.status }],
          });
          return {
            id: r.id,
            amount_sar: r.amount_sar,
            due_date: r.due_date,
            paid_at: r.paid_at,
            status: r.status,
            property_name: r.property_name,
            unit_label: r.unit_label,
            owner_contract_summary: summary,
          };
        });
        return ok(mapped);
      }
      return ok(rows);
    }

    if (type === "contracts") {
      const params: any[] = [Array.isArray(propertyIds) ? propertyIds : ownerIds];
      let idx = 2;
      let conditions = "";
      if (dateFrom) { conditions += ` AND c.start_date >= $${idx++}`; params.push(dateFrom); }
      if (dateTo) { conditions += ` AND c.start_date <= $${idx++}`; params.push(dateTo); }
      if (status) { conditions += ` AND c.status = $${idx++}`; params.push(status); }
      if (propertyId) { conditions += ` AND c.property_id = $${idx++}`; params.push(propertyId); }
      if (contactId) { conditions += ` AND c.contact_id = $${idx++}`; params.push(contactId); }

      const rows = await ds.query(
        `
        SELECT
          c.id, c.status, c.start_date, c.end_date, c.rent_total_sar,
          p.name AS property_name,
          u.label AS unit_label,
          ct.name AS contact_name,
          ct.phone AS contact_phone
        FROM contracts c
        LEFT JOIN properties p ON p.id = c.property_id
        LEFT JOIN units u ON u.id = c.unit_id
        LEFT JOIN contacts ct ON ct.id = c.contact_id
        WHERE ${
          Array.isArray(propertyIds) ? "c.property_id = ANY($1)" : "c.owner_id = ANY($1)"
        } ${conditions}
        ORDER BY c.start_date DESC
        LIMIT 2000
        `,
        params
      );
      if (ownerHidesTenantPii(user)) {
        return ok(
          (rows as any[]).map((r) => ({
            id: r.id,
            status: r.status,
            start_date: r.start_date,
            end_date: r.end_date,
            rent_total_sar: r.rent_total_sar,
            property_name: r.property_name,
            unit_label: r.unit_label,
            owner_contract_summary: buildOwnerContractSummary({
              end_date: r.end_date,
              start_date: r.start_date,
              unit_label: r.unit_label,
            }),
          }))
        );
      }
      return ok(rows);
    }

    if (type === "vacancy") {
      const rows = await ds.query(
        `
        SELECT
          p.id AS property_id,
          p.name AS property_name,
          COUNT(u.id) AS total_units,
          COUNT(u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
          CASE WHEN COUNT(u.id) > 0
            THEN ROUND(100.0 * COUNT(u.id) FILTER (WHERE u.status = 'occupied') / COUNT(u.id), 1)
            ELSE 0
          END AS occupancy_rate_percent
        FROM properties p
        LEFT JOIN units u ON u.property_id = p.id
        WHERE p.owner_id = ANY($1)
        GROUP BY p.id, p.name
        ORDER BY p.name ASC
        `,
        [ownerIds]
      );
      return ok(rows);
    }

    return ok([]);
  } catch (err) {
    return serverError(err);
  }
}
