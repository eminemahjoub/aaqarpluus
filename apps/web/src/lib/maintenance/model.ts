import brain from "brain.js";
import { getDataSource } from "@/lib/db/data-source";

// ---------------------------------------------------------------------------
// Predictive-maintenance AI model — a real neural network (multi-layer
// perceptron trained with backpropagation) built with brain.js.
// Trained on real platform data:
//   • positives = maintenance tasks marked done (failures that happened)
//   • negatives = units with an active contract that never produced maintenance
// The trained network is serialized and persisted in platform_settings (jsonb)
// under MAINTENANCE_MODEL_V1. Fallback exists when no model is trained yet.
// ---------------------------------------------------------------------------

export const MODEL_SETTINGS_KEY = "maintenance_model_v1";
export const MIN_TRAIN_SAMPLES = 10;
export const MODEL_WEIGHT = 0.3; // model contribution to the final score (rest is the rule engine)

export interface MaintenanceModel {
  version: number;
  trainedAt: string;
  samples: { total: number; positive: number; negative: number };
  metrics: { accuracy: number; loss: number };
  mean: number[];
  std: number[];
  net: any; // serialized brain.js network (net.toJSON())
  features: string[];
}

export interface ModelSample {
  features: number[];
  label: number; // 1 = failure, 0 = no failure
}

// Feature order — must stay in sync with the training script and feature extractor.
export const FEATURES = [
  "building_age_years",
  "ac_months_since_service",
  "plumbing_months_since_check",
  "electrical_months_since_check",
  "is_summer",
  "is_winter",
  "prior_failures_12m",
  "occupancy_months",
  "is_villa",
  "is_apartment",
  "is_studio",
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Standard-score normalization mapped to [0,1] (brain.js input range).
function normalize(features: number[], mean: number[], std: number[]): number[] {
  return features.map((f, i) => {
    const z = std[i] > 1e-9 ? (f - mean[i]) / std[i] : 0;
    return (clamp(z, -3, 3) + 3) / 6;
  });
}

export function predictProbability(model: MaintenanceModel, features: number[]): number {
  const net = new brain.NeuralNetwork();
  net.fromJSON(model.net);
  const out = net.run(normalize(features, model.mean, model.std)) as number[];
  const p = Number(out?.[0] ?? 0);
  return clamp(p, 0, 1);
}

// Feature extraction from a unit + its context (shared by training & inference)
export async function extractFeatures(
  ds: any,
  unit: any,
  context?: { history?: Array<{ type: string; cnt: number }>; contractStart?: Date | null; propertyModelType?: string | null },
): Promise<number[]> {
  const now = new Date();

  const property = (unit as any).property ?? null;
  const propCreated = property?.created_at ?? (unit as any).property_created_at ?? null;
  const rawAge =
    (property as any)?.building_age != null
      ? Number((property as any).building_age)
      : propCreated
        ? (now.getTime() - new Date(propCreated).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        : 0;
  const buildingAgeYears = Number.isFinite(rawAge) ? rawAge : 0;

  const monthsSince = (date: any, fallbackMonths: number): number => {
    if (!date) return fallbackMonths;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return fallbackMonths;
    const m = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return clamp(m, 0, 36);
  };

  let history: Array<{ type: string; cnt: number }> = context?.history ?? [];
  if (history.length === 0) {
    const rows = await ds.query(
      `SELECT predicted_failure_type AS type, COUNT(*)::int AS cnt
       FROM maintenance_predictions
       WHERE unit_id = $1 AND prediction_date >= (CURRENT_DATE - INTERVAL '12 months')
       GROUP BY predicted_failure_type`,
      [String(unit.id)]
    );
    history = rows ?? [];
  }
  const priorFailures = history.reduce((acc, h) => acc + Number(h.cnt || 0), 0);

  let contractStart: Date | null = context?.contractStart ?? null;
  if (!contractStart) {
    const rows = await ds.query(
      `SELECT start_date FROM contracts
       WHERE deleted_at IS NULL AND unit_id = $1 AND status = 'active'
       ORDER BY start_date DESC LIMIT 1`,
      [String(unit.id)]
    );
    contractStart = rows?.[0]?.start_date ? new Date(rows[0].start_date) : null;
  }
  const occupancyMonths = contractStart
    ? clamp((now.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 0, 36)
    : 0;

  const modelType = String(
    context?.propertyModelType ?? property?.property_model_type ?? (unit as any).property_model_type ?? "",
  ).toLowerCase();

  const month = now.getMonth();
  return [
    buildingAgeYears,
    monthsSince((unit as any).last_ac_service_date, 24),
    monthsSince((unit as any).last_plumbing_check_date, 24),
    monthsSince((unit as any).last_electrical_check_date, 24),
    month >= 4 && month <= 6 ? 1 : 0,
    month === 11 || month === 0 || month === 1 ? 1 : 0,
    clamp(priorFailures, 0, 5),
    occupancyMonths,
    modelType.includes("villa") ? 1 : 0,
    modelType.includes("apartment") || modelType.includes("شقة") ? 1 : 0,
    modelType.includes("studio") ? 1 : 0,
  ];
}

export async function loadMaintenanceModel(): Promise<MaintenanceModel | null> {
  try {
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
      [MODEL_SETTINGS_KEY]
    );
    const raw = rows?.[0]?.value;
    if (!raw) return null;
    const model = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!model?.net) return null;
    return model as MaintenanceModel;
  } catch {
    return null;
  }
}

export async function saveMaintenanceModel(model: MaintenanceModel): Promise<void> {
  const ds = await getDataSource();
  await ds.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [MODEL_SETTINGS_KEY, JSON.stringify(model)]
  );
}

// ---------------------------------------------------------------------------
// Training: real neural network (brain.js) with standardized features.
// ---------------------------------------------------------------------------
export async function trainMaintenanceModel(): Promise<{ model: MaintenanceModel; trained: boolean; reason?: string }> {
  const ds = await getDataSource();

  // Positive: real maintenance tasks marked done (failures that happened)
  const positivesRaw = await ds.query(
    `SELECT t.unit_id, COUNT(*)::int AS cnt
     FROM tasks t
     WHERE t.deleted_at IS NULL
       AND t.type = 'maintenance'
       AND t.status = 'done'
       AND t.unit_id IS NOT NULL
     GROUP BY t.unit_id
     ORDER BY cnt DESC
     LIMIT 500`
  );

  // Negative: units with an active contract that never produced a maintenance task
  const negativesRaw = await ds.query(
    `SELECT u.id AS unit_id
     FROM units u
     JOIN contracts c ON c.unit_id = u.id AND c.deleted_at IS NULL AND c.status = 'active'
     WHERE u.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM tasks t
         WHERE t.unit_id = u.id AND t.deleted_at IS NULL AND t.type = 'maintenance'
       )
     GROUP BY u.id
     LIMIT 500`
  );

  const positiveIds = Array.from(new Set((positivesRaw ?? []).map((r: any) => String(r.unit_id)))) as string[];
  let negativeIds = Array.from(new Set((negativesRaw ?? []).map((r: any) => String(r.unit_id)))) as string[];

  if (positiveIds.length + negativeIds.length < MIN_TRAIN_SAMPLES) {
    return {
      trained: false,
      reason: `بيانات تدريب غير كافية (${positiveIds.length} إيجابية / ${negativeIds.length} سلبية — الحد الأدنى ${MIN_TRAIN_SAMPLES})`,
    } as any;
  }

  // Balance: cap negatives at 2× positives so the network sees both classes fairly
  if (positiveIds.length > 0 && negativeIds.length > positiveIds.length * 2) {
    negativeIds = negativeIds.slice(0, positiveIds.length * 2);
  }

  // Load units + properties for all training ids
  const allIds = [...positiveIds, ...negativeIds];
  const unitRows = await ds.query(
    `SELECT u.id, u.property_id, u.last_ac_service_date, u.last_plumbing_check_date, u.last_electrical_check_date,
            p.property_model_type, p.created_at AS property_created_at
     FROM units u
     LEFT JOIN properties p ON p.id = u.property_id
     WHERE u.id = ANY($1)`,
    [allIds]
  );
  const unitById = new Map(unitRows.map((u: any) => [String(u.id), u]));

  const samples: ModelSample[] = [];
  const labelById = new Map<string, number>();
  for (const id of positiveIds) labelById.set(id, 1);
  for (const id of negativeIds) labelById.set(id, 0);

  for (const [id, label] of labelById) {
    const unit = unitById.get(id);
    if (!unit) continue;
    const features = await extractFeatures(ds, unit);
    samples.push({ features, label });
  }

  if (samples.length < MIN_TRAIN_SAMPLES) {
    return { trained: false, reason: `بيانات تدريب غير كافية بعد الربط (${samples.length})` } as any;
  }

  // Standardize
  const n = samples.length;
  const d = samples[0].features.length;
  const mean: number[] = new Array(d).fill(0);
  for (const s of samples) for (let i = 0; i < d; i++) mean[i] += s.features[i] / n;
  const std: number[] = new Array(d).fill(0);
  for (const s of samples) {
    for (let i = 0; i < d; i++) {
      const diff = s.features[i] - mean[i];
      std[i] += diff * diff;
    }
  }
  for (let i = 0; i < d; i++) std[i] = Math.sqrt(std[i] / n) || 1;

  // Train the neural network
  const net = new brain.NeuralNetwork({ hiddenLayers: [8, 4], activation: "leaky-relu" });
  const trainingData = samples.map((s) => ({
    input: normalize(s.features, mean, std),
    output: [s.label],
  }));
  const trainResult = net.train(trainingData, {
    iterations: 600,
    errorThresh: 0.005,
  });

  // Accuracy on the training set
  let correct = 0;
  for (const s of samples) {
    const out = net.run(normalize(s.features, mean, std)) as number[];
    const pred = Number(out?.[0] ?? 0) >= 0.5 ? 1 : 0;
    if (pred === s.label) correct++;
  }

  const model: MaintenanceModel = {
    version: 1,
    trainedAt: new Date().toISOString(),
    samples: {
      total: n,
      positive: samples.filter((s) => s.label === 1).length,
      negative: samples.filter((s) => s.label === 0).length,
    },
    metrics: { accuracy: correct / n, loss: trainResult.error },
    mean,
    std,
    net: net.toJSON(),
    features: FEATURES,
  };

  await saveMaintenanceModel(model);
  return { model, trained: true };
}

// Cached model + loaded network for inference
let cachedModel: MaintenanceModel | null | undefined;
export async function getMaintenanceModel(): Promise<MaintenanceModel | null> {
  if (cachedModel === undefined) cachedModel = await loadMaintenanceModel();
  return cachedModel;
}
export function invalidateModelCache() {
  cachedModel = undefined;
}
