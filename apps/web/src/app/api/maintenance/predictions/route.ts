export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, badRequest, serverError } from "@/lib/api-helpers";
import { parsePagination } from "@/lib/pagination";
import { predictMaintenanceRisk, savePrediction } from "@/lib/maintenance/predictor";
import { logAudit } from "@/lib/audit";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType === "superadmin") return null; // all
  if (userType !== "agency") {
    return ds
      .query(`SELECT id FROM properties WHERE deleted_at IS NULL AND owner_id = $1`, [String(user.userId)])
      .then((rows: any[]) => rows.map((r) => String(r.id)));
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const officeClause = officeId
    ? `OR EXISTS (SELECT 1 FROM office_property_links l WHERE l.property_id = p.id AND l.office_id = $2)`
    : "";
  const params: any[] = [agencyId];
  if (officeId) params.push(officeId);
  const rows = await ds.query(
    `SELECT p.id FROM properties p
     WHERE p.deleted_at IS NULL
       AND (p.created_by_agency_id = $1 OR p.owner_id = $1 ${officeClause})`,
    params
  );
  return Array.from(new Set((rows ?? []).map((r: any) => String(r.id))));
}

const FAILURE_TYPE_LABELS: Record<string, string> = {
  ac: "مكيف",
  plumbing: "سباكة",
  electrical: "كهرباء",
  general: "عام",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const riskLevel = searchParams.get("risk_level");
    const propertyId = searchParams.get("property_id");
    const resolved = searchParams.get("resolved") === "true";
    const pagination = parsePagination(searchParams);

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) {
        return ok({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
      }
      conditions.push(`u.property_id = ANY($${idx++})`);
      params.push(propertyIds);
    }
    if (riskLevel) {
      conditions.push(`mp.risk_level = $${idx++}`);
      params.push(String(riskLevel));
    }
    if (propertyId) {
      conditions.push(`u.property_id = $${idx++}`);
      params.push(String(propertyId));
    }
    conditions.push(`mp.is_resolved = $${idx++}`);
    params.push(resolved);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRow = await ds.query(
      `SELECT COUNT(*)::int AS total
       FROM maintenance_predictions mp
       JOIN units u ON u.id = mp.unit_id
       ${where}`,
      params
    );
    const total = Number(countRow?.[0]?.total) || 0;

    const limit = pagination?.limit ?? 50;
    const page = pagination?.page ?? 1;
    const offset = pagination?.offset ?? 0;

    const rows = await ds.query(
      `SELECT mp.id, mp.risk_score, mp.risk_level, mp.predicted_failure_type,
              mp.predicted_failure_date, mp.suggested_action, mp.estimated_cost_sar,
              mp.is_resolved, mp.created_at, mp.prediction_date,
              u.id AS unit_id, u.label AS unit_label,
              p.id AS property_id, p.name AS property_name
       FROM maintenance_predictions mp
       JOIN units u ON u.id = mp.unit_id
       LEFT JOIN properties p ON p.id = u.property_id
       ${where}
       ORDER BY mp.risk_score DESC, mp.predicted_failure_date ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const data = (rows ?? []).map((r: any) => ({
      id: r.id,
      unit: {
        id: r.unit_id,
        name: r.unit_label,
        property: { id: r.property_id, name: r.property_name },
      },
      riskScore: Number(r.risk_score) || 0,
      riskLevel: r.risk_level,
      predictedFailureType: r.predicted_failure_type,
      predictedFailureTypeLabel: FAILURE_TYPE_LABELS[String(r.predicted_failure_type)] ?? r.predicted_failure_type,
      predictedFailureDate: r.predicted_failure_date ? new Date(r.predicted_failure_date).toISOString() : null,
      suggestedAction: r.suggested_action,
      estimatedCostSar: r.estimated_cost_sar != null ? Number(r.estimated_cost_sar) : null,
      isResolved: Boolean(r.is_resolved),
      predictionDate: r.prediction_date ? new Date(r.prediction_date).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    return ok({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as { unitId?: string };
    const ds = await getDataSource();

    if (body.unitId) {
      // Single-unit recalculation
      const unit = await ds.getRepository("Unit").findOne({ where: { id: String(body.unitId) } as any });
      if (!unit) return badRequest("الوحدة غير موجودة");

      // Reuse the scope check from getAccessiblePropertyIds
      const propertyIds = await getAccessiblePropertyIds(ds, user);
      const pid = String((unit as any).property_id ?? "");
      if (Array.isArray(propertyIds) && (propertyIds.length === 0 || !propertyIds.includes(pid))) {
        return unauthorized();
      }
      const result = await predictMaintenanceRisk(String(body.unitId));
      const prediction = await savePrediction(String(body.unitId), result);
      return ok({ unitId: String(body.unitId), result, predictionId: prediction.id });
    }

    // Batch: run analysis for all accessible units with an active contract
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let units: any[] = [];
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok({ processed: 0, results: [] });
      units = await ds.query(
        `SELECT DISTINCT u.id FROM units u
         JOIN contracts c ON c.unit_id = u.id AND c.deleted_at IS NULL AND c.status = 'active'
         WHERE u.deleted_at IS NULL AND u.property_id = ANY($1)`,
        [propertyIds]
      );
    } else {
      units = await ds.query(
        `SELECT DISTINCT u.id FROM units u
         JOIN contracts c ON c.unit_id = u.id AND c.deleted_at IS NULL AND c.status = 'active'
         WHERE u.deleted_at IS NULL`
      );
    }

    const results: Array<{ unitId: string; riskScore: number; riskLevel: string; predictionId: string }> = [];
    for (const u of units ?? []) {
      try {
        const unitId = String(u.id);
        const result = await predictMaintenanceRisk(unitId);
        const prediction = await savePrediction(unitId, result);
        results.push({ unitId, riskScore: result.riskScore, riskLevel: result.riskLevel, predictionId: prediction.id });
      } catch {
        // one failure must not stop the batch
      }
    }

    await logAudit({
      userId: user.userId,
      action: "maintenance_prediction.batch_run",
      entityType: "unit",
      metadata: { count: results.length },
      req,
    });

    return ok({ processed: results.length, results });
  } catch (err) {
    return serverError(err);
  }
}
