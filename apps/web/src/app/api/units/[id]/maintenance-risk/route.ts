export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import {
  getLatestPrediction,
  predictMaintenanceRisk,
  savePrediction,
  type MaintenancePrediction,
} from "@/lib/maintenance/predictor";

async function assertCanAccessUnit(ds: any, user: any, unitId: string): Promise<boolean> {
  const userType = String(user.userType ?? "");
  const repo = ds.getRepository("Unit");
  const unit = await repo.findOne({ where: { id: unitId } as any, relations: { property: true } as any });
  if (!unit) return false;
  if (userType === "superadmin") return true;
  if (userType !== "agency") {
    return String((unit as any).owner_id) === String(user.userId);
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const pid = String((unit as any).property_id ?? "");
  if (!pid) return false;
  if (officeId) {
    const linked = await ds.query(
      "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
      [officeId, pid]
    );
    if (Array.isArray(linked) && linked.length > 0) return true;
  }
  const rows = await ds.query(
    `SELECT 1 AS ok FROM properties p
     WHERE p.id = $1 AND p.deleted_at IS NULL
       AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = p.owner_id
           AND u.created_by_agency_id = $2
           AND u.deleted_at IS NULL
       ))
     LIMIT 1`,
    [pid, agencyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

function serializePrediction(prediction: MaintenancePrediction | null) {
  if (!prediction) return null;
  return {
    id: prediction.id,
    riskScore: prediction.risk_score,
    riskLevel: prediction.risk_level,
    predictedFailureType: prediction.predicted_failure_type,
    predictedFailureDate: prediction.predicted_failure_date ? new Date(prediction.predicted_failure_date).toISOString() : null,
    suggestedAction: prediction.suggested_action,
    estimatedCostSar: prediction.estimated_cost_sar != null ? Number(prediction.estimated_cost_sar) : null,
    isResolved: prediction.is_resolved,
    createdAt: new Date(prediction.created_at).toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    if (!(await assertCanAccessUnit(ds, user, id))) return unauthorized();

    const unitRepo = ds.getRepository("Unit");
    const unit = (await unitRepo.findOne({ where: { id } as any })) as any;

    // Recalculate if no stored prediction exists
    let prediction = await getLatestPrediction(id);
    let recalculated = false;
    if (!prediction) {
      const result = await predictMaintenanceRisk(id);
      prediction = await savePrediction(id, result);
      recalculated = true;
    }

    return ok({
      ...serializePrediction(prediction),
      lastAcServiceDate: unit?.last_ac_service_date ? new Date(unit.last_ac_service_date).toISOString() : null,
      lastPlumbingCheckDate: unit?.last_plumbing_check_date ? new Date(unit.last_plumbing_check_date).toISOString() : null,
      lastElectricalCheckDate: unit?.last_electrical_check_date ? new Date(unit.last_electrical_check_date).toISOString() : null,
      recalculated,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    if (!(await assertCanAccessUnit(ds, user, id))) return unauthorized();

    const result = await predictMaintenanceRisk(id);
    const prediction = await savePrediction(id, result);

    return ok({
      ...serializePrediction(prediction),
      factors: result.factors,
    });
  } catch (err) {
    return serverError(err);
  }
}
