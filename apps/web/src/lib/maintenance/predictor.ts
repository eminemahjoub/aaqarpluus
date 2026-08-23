import { getDataSource } from "@/lib/db/data-source";
import { getMaintenanceModel, extractFeatures, predictProbability, MODEL_WEIGHT } from "@/lib/maintenance/model";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FailureType = "ac" | "plumbing" | "electrical" | "general";

export interface RiskFactor {
  name: string;
  label: string;
  points: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  predictedFailureType: FailureType;
  predictedFailureDate: Date | null;
  suggestedAction: string;
  estimatedCostSar: number | null;
  factors: RiskFactor[];
}

export interface MaintenancePrediction {
  id: string;
  unit_id: string;
  prediction_date: Date | string;
  risk_score: number;
  risk_level: RiskLevel;
  predicted_failure_type: FailureType;
  predicted_failure_date: Date | string | null;
  suggested_action: string;
  estimated_cost_sar: number | null;
  is_resolved: boolean;
  resolved_at: Date | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const SUGGESTED_ACTIONS: Record<FailureType, string> = {
  ac: "صيانة دورية لمكيف الهواء - فحص ضغط الفريون وتنظيف الفلاتر",
  plumbing: "فحص شامل لشبكة السباكة - تفقد التسريبات وضغط المياه",
  electrical: "فحص كهربائي شامل - تفقد القواطع والتوصيلات",
  general: "صيانة دورية شاملة للوحدة",
};

const ESTIMATED_COSTS: Record<FailureType, number> = {
  ac: 600,
  plumbing: 450,
  electrical: 525,
  general: 500,
};

function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score > 75) return "critical";
  if (score > 50) return "high";
  if (score > 25) return "medium";
  return "low";
}

export async function predictMaintenanceRisk(unitId: string): Promise<RiskResult> {
  const ds = await getDataSource();
  const unitRepo = ds.getRepository("Unit");
  const unit = (await unitRepo.findOne({
    where: { id: unitId } as any,
    relations: { property: true } as any,
  })) as any;

  const now = new Date();
  const factors: RiskFactor[] = [];
  let acPoints = 0;
  let plumbingPoints = 0;
  let electricalPoints = 0;

  if (!unit) {
    return {
      riskScore: 0,
      riskLevel: "low",
      predictedFailureType: "general",
      predictedFailureDate: null,
      suggestedAction: SUGGESTED_ACTIONS.general,
      estimatedCostSar: ESTIMATED_COSTS.general,
      factors,
    };
  }

  // 1. Building age (from property.building_age or property.created_at)
  const property = unit.property ?? null;
  const rawAge =
    (property as any)?.building_age != null
      ? Number((property as any).building_age)
      : property?.created_at
        ? (now.getTime() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        : 0;
  const buildingAgeYears = Number.isFinite(rawAge) ? rawAge : 0;
  const agePoints = buildingAgeYears > 5 ? Math.min(30, Math.round((buildingAgeYears - 5) * 5)) : 0;
  if (agePoints > 0) {
    factors.push({ name: "building_age", label: `عمر المبنى (${Math.round(buildingAgeYears)} سنة)`, points: agePoints });
    acPoints += agePoints;
    plumbingPoints += agePoints;
    electricalPoints += agePoints;
  }

  // 2. Service recency
  const acDate = unit.last_ac_service_date ? new Date(unit.last_ac_service_date) : null;
  const plumbingDate = unit.last_plumbing_check_date ? new Date(unit.last_plumbing_check_date) : null;
  const electricalDate = unit.last_electrical_check_date ? new Date(unit.last_electrical_check_date) : null;

  let acRecencyPoints = 0;
  if (!acDate) {
    acRecencyPoints = 20;
  } else {
    const m = monthsBetween(acDate, now);
    if (m > 12) acRecencyPoints = 20;
    else if (m > 6) acRecencyPoints = 10;
  }
  if (acRecencyPoints > 0) {
    factors.push({ name: "ac_recency", label: acDate ? "تأخر صيانة المكيف" : "لا يوجد سجل صيانة للمكيف", points: acRecencyPoints });
    acPoints += acRecencyPoints;
  }

  let plumbingRecencyPoints = 0;
  if (!plumbingDate || monthsBetween(plumbingDate, now) > 18) plumbingRecencyPoints = 15;
  if (plumbingRecencyPoints > 0) {
    factors.push({ name: "plumbing_recency", label: plumbingDate ? "تأخر فحص السباكة" : "لا يوجد سجل فحص للسباكة", points: plumbingRecencyPoints });
    plumbingPoints += plumbingRecencyPoints;
  }

  let electricalRecencyPoints = 0;
  if (!electricalDate || monthsBetween(electricalDate, now) > 24) electricalRecencyPoints = 15;
  if (electricalRecencyPoints > 0) {
    factors.push({ name: "electrical_recency", label: electricalDate ? "تأخر الفحص الكهربائي" : "لا يوجد سجل فحص كهربائي", points: electricalRecencyPoints });
    electricalPoints += electricalRecencyPoints;
  }

  // 3. Seasonal risk (Saudi climate)
  const month = now.getMonth(); // 0-indexed
  const isSummer = month >= 4 && month <= 6; // May-July
  const isWinter = month === 11 || month === 0 || month === 1; // Dec-Feb
  if (isSummer && buildingAgeYears > 3) {
    factors.push({ name: "seasonal_ac", label: "موسم حرارة الصيف (مكيفات)", points: 15 });
    acPoints += 15;
  }
  if (isWinter && buildingAgeYears > 5) {
    factors.push({ name: "seasonal_plumbing", label: "موسم الشتاء (سباكة)", points: 10 });
    plumbingPoints += 10;
  }

  // 4. Historical failure pattern (last 12 months)
  const history = await ds.query(
    `SELECT predicted_failure_type, COUNT(*)::int AS cnt
     FROM maintenance_predictions
     WHERE unit_id = $1
       AND prediction_date >= (CURRENT_DATE - INTERVAL '12 months')
     GROUP BY predicted_failure_type`,
    [unitId]
  );
  const histByType: Record<string, number> = {};
  for (const h of history ?? []) histByType[String(h.predicted_failure_type)] = Number(h.cnt) || 0;
  for (const [type, cnt] of Object.entries(histByType)) {
    const pts = Math.min(cnt, 5) * 10;
    if (pts > 0) {
      factors.push({ name: `hist_${type}`, label: `أعطال سابقة من نوع ${type}`, points: pts });
      if (type === "ac") acPoints += pts;
      else if (type === "plumbing") plumbingPoints += pts;
      else if (type === "electrical") electricalPoints += pts;
      else {
        acPoints += pts;
        plumbingPoints += pts;
        electricalPoints += pts;
      }
    }
  }

  // 5. Occupancy intensity: active contract for > 6 months continuously
  const occupancyRows = await ds.query(
    `SELECT 1 AS ok FROM contracts
     WHERE deleted_at IS NULL
       AND unit_id = $1
       AND status = 'active'
       AND start_date IS NOT NULL
       AND start_date <= (CURRENT_DATE - INTERVAL '6 months')
     LIMIT 1`,
    [unitId]
  );
  const highUsage = Array.isArray(occupancyRows) && occupancyRows.length > 0;
  if (highUsage) {
    factors.push({ name: "occupancy", label: "إشغال مستمر لأكثر من ٦ أشهر", points: 5 });
    acPoints += 5;
    plumbingPoints += 5;
    electricalPoints += 5;
  }

  // 6. Property type
  const modelType = String((property as any)?.property_model_type ?? "").toLowerCase();
  let typePoints = 0;
  if (modelType.includes("villa")) typePoints = 10;
  else if (modelType.includes("studio")) typePoints = 3;
  else if (modelType.includes("apartment") || modelType.includes("شقة")) typePoints = 5;
  if (typePoints > 0) {
    factors.push({ name: "property_type", label: `نوع العقار: ${(property as any)?.property_model_type}`, points: typePoints });
    acPoints += typePoints;
    plumbingPoints += typePoints;
    electricalPoints += typePoints;
  }

  const totalPoints = acPoints + plumbingPoints + electricalPoints;
  const ruleScore = clamp(Math.round(totalPoints), 0, 100);

  // --- ML blend: rule engine (70%) + trained logistic-regression model (30%) ---
  let modelScore: number | null = null;
  let mlPoints = 0;
  try {
    const model = await getMaintenanceModel();
    if (model) {
      const features = await extractFeatures(ds, unit, { history: history as any });
      const prob = predictProbability(model, features);
      modelScore = clamp(Math.round(prob * 100), 0, 100);
      mlPoints = Math.round((modelScore - ruleScore) * MODEL_WEIGHT);
      factors.push({ name: "ml_model", label: "توقع نموذج التعلم الآلي", points: mlPoints });
    }
  } catch {
    // model failure must never break prediction — fall back to rule engine only
  }

  const riskScore = clamp(Math.round(ruleScore * (1 - MODEL_WEIGHT) + (modelScore ?? ruleScore) * MODEL_WEIGHT), 0, 100);
  const riskLevel = riskLevelFromScore(riskScore);

  // Predicted failure type from the highest contributing factor
  const maxTypePoints = Math.max(acPoints, plumbingPoints, electricalPoints);
  let predictedFailureType: FailureType = "general";
  if (maxTypePoints > 0) {
    if (acPoints === maxTypePoints && acPoints > 0) predictedFailureType = "ac";
    else if (plumbingPoints === maxTypePoints && plumbingPoints > 0) predictedFailureType = "plumbing";
    else if (electricalPoints === maxTypePoints && electricalPoints > 0) predictedFailureType = "electrical";
  }

  // Predicted failure date
  let predictedFailureDate: Date | null = null;
  if (riskScore > 75) predictedFailureDate = new Date(now.getTime() + 14 * 86400000);
  else if (riskScore > 50) predictedFailureDate = new Date(now.getTime() + 30 * 86400000);
  else if (riskScore > 25) predictedFailureDate = new Date(now.getTime() + 60 * 86400000);

  return {
    riskScore,
    riskLevel,
    predictedFailureType,
    predictedFailureDate,
    suggestedAction: SUGGESTED_ACTIONS[predictedFailureType],
    estimatedCostSar: ESTIMATED_COSTS[predictedFailureType],
    factors,
  };
}

export async function savePrediction(unitId: string, result: RiskResult): Promise<MaintenancePrediction> {
  const ds = await getDataSource();
  const repo = ds.getRepository("MaintenancePrediction");

  const saved = await repo.save(
    repo.create({
      unit_id: unitId,
      prediction_date: new Date(),
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      predicted_failure_type: result.predictedFailureType,
      predicted_failure_date: result.predictedFailureDate,
      suggested_action: result.suggestedAction,
      estimated_cost_sar: result.estimatedCostSar,
      is_resolved: false,
    } as any)
  );

  // Keep the unit's rolling risk snapshot in sync
  await ds
    .getRepository("Unit")
    .update(unitId, {
      maintenance_risk_score: result.riskScore,
      maintenance_risk_level: result.riskLevel,
    } as any);

  return saved as unknown as MaintenancePrediction;
}

export async function getLatestPrediction(unitId: string): Promise<MaintenancePrediction | null> {
  const ds = await getDataSource();
  const repo = ds.getRepository("MaintenancePrediction");
  const row = await repo.findOne({
    where: { unit_id: unitId, is_resolved: false } as any,
    order: { prediction_date: "DESC", created_at: "DESC" } as any,
  });
  return (row as unknown as MaintenancePrediction) ?? null;
}

export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return daysBetween(new Date(), d);
}
