// Train the predictive-maintenance ML model on real platform data.
// Usage: node --env-file .env.local scripts/train-maintenance-model.mjs
// Mirrors src/lib/maintenance/model.ts (kept in sync manually, like the other .mjs scripts).
// Ground truth: maintenance tasks marked done = failure events.

import pg from "pg";
import brain from "brain.js";

const { Pool } = pg;

const MODEL_SETTINGS_KEY = "maintenance_model_v1";
const MIN_TRAIN_SAMPLES = 10;

const FEATURES = [
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

const pool = new Pool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "property_crm",
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Standard-score normalization mapped to [0,1] (brain.js input range).
const normalize = (features, mean, std) =>
  features.map((f, i) => {
    const z = std[i] > 1e-9 ? (f - mean[i]) / std[i] : 0;
    return (clamp(z, -3, 3) + 3) / 6;
  });

async function extractFeatures(client, unit) {
  const now = new Date();
  const created = unit.property_created_at ? new Date(unit.property_created_at) : null;
  const rawAge = unit.building_age ?? (created ? (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0);
  const buildingAgeYears = Number.isFinite(rawAge) ? rawAge : 0;

  const monthsSince = (date, fallback) => {
    if (!date) return fallback;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return fallback;
    return clamp((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 0, 36);
  };

  const hist = await client.query(
    `SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
       SELECT COUNT(*)::int AS cnt FROM maintenance_predictions
       WHERE unit_id = $1 AND prediction_date >= (CURRENT_DATE - INTERVAL '12 months')
     ) h`,
    [unit.id]
  );
  const priorFailures = Number(hist.rows?.[0]?.total ?? 0);

  const contract = await client.query(
    `SELECT start_date FROM contracts
     WHERE deleted_at IS NULL AND unit_id = $1 AND status = 'active'
     ORDER BY start_date DESC LIMIT 1`,
    [unit.id]
  );
  const contractStart = contract.rows?.[0]?.start_date ? new Date(contract.rows[0].start_date) : null;
  const occupancyMonths = contractStart ? clamp((now.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 0, 36) : 0;

  const modelType = String(unit.property_model_type ?? "").toLowerCase();
  const month = now.getMonth();

  return [
    buildingAgeYears,
    monthsSince(unit.last_ac_service_date, 24),
    monthsSince(unit.last_plumbing_check_date, 24),
    monthsSince(unit.last_electrical_check_date, 24),
    month >= 4 && month <= 6 ? 1 : 0,
    month === 11 || month === 0 || month === 1 ? 1 : 0,
    clamp(priorFailures, 0, 5),
    occupancyMonths,
    modelType.includes("villa") ? 1 : 0,
    modelType.includes("apartment") || modelType.includes("شقة") ? 1 : 0,
    modelType.includes("studio") ? 1 : 0,
  ];
}

async function main() {
  const client = await pool.connect();
  try {
    const pos = await client.query(
      `SELECT unit_id, COUNT(*)::int AS cnt FROM tasks
       WHERE deleted_at IS NULL AND type = 'maintenance' AND status = 'done' AND unit_id IS NOT NULL
       GROUP BY unit_id ORDER BY cnt DESC LIMIT 500`
    );
    const neg = await client.query(
      `SELECT u.id AS unit_id FROM units u
       JOIN contracts c ON c.unit_id = u.id AND c.deleted_at IS NULL AND c.status = 'active'
       WHERE u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.unit_id = u.id AND t.deleted_at IS NULL AND t.type = 'maintenance')
       GROUP BY u.id LIMIT 500`
    );

    const positiveIds = [...new Set(pos.rows.map((r) => String(r.unit_id)))];
    let negativeIds = [...new Set(neg.rows.map((r) => String(r.unit_id)))];

    if (positiveIds.length + negativeIds.length < MIN_TRAIN_SAMPLES) {
      console.log(`⚠️ Not enough data: ${positiveIds.length} positive / ${negativeIds.length} negative (min ${MIN_TRAIN_SAMPLES})`);
      return;
    }

    // Balance: cap negatives at 2× positives
    if (positiveIds.length > 0 && negativeIds.length > positiveIds.length * 2) {
      negativeIds = negativeIds.slice(0, positiveIds.length * 2);
    }

    const allIds = [...positiveIds, ...negativeIds];
    const units = await client.query(
      `SELECT u.id, u.last_ac_service_date, u.last_plumbing_check_date, u.last_electrical_check_date,
              p.property_model_type, p.created_at AS property_created_at
       FROM units u LEFT JOIN properties p ON p.id = u.property_id
       WHERE u.id = ANY($1)`,
      [allIds]
    );
    const unitById = new Map(units.rows.map((u) => [String(u.id), u]));

    const labelById = new Map();
    for (const id of positiveIds) labelById.set(id, 1);
    for (const id of negativeIds) labelById.set(id, 0);

    const samples = [];
    for (const [id, label] of labelById) {
      const unit = unitById.get(id);
      if (!unit) continue;
      samples.push({ features: await extractFeatures(client, unit), label });
    }
    if (samples.length < MIN_TRAIN_SAMPLES) {
      console.log(`⚠️ Not enough linked samples: ${samples.length}`);
      return;
    }

    const n = samples.length;
    const d = samples[0].features.length;
    const mean = new Array(d).fill(0);
    for (const s of samples) for (let i = 0; i < d; i++) mean[i] += s.features[i] / n;
    const std = new Array(d).fill(0);
    for (const s of samples) for (let i = 0; i < d; i++) std[i] += (s.features[i] - mean[i]) ** 2;
    for (let i = 0; i < d; i++) std[i] = Math.sqrt(std[i] / n) || 1;

    // Train a real neural network (brain.js) — MLP with 2 hidden layers
    const net = new brain.NeuralNetwork({ hiddenLayers: [8, 4], activation: "leaky-relu" });
    const trainingData = samples.map((s) => ({ input: normalize(s.features, mean, std), output: [s.label] }));
    const trainResult = net.train(trainingData, { iterations: 600, errorThresh: 0.005 });

    let correct = 0;
    for (const s of samples) {
      const pred = Number(net.run(normalize(s.features, mean, std))[0]) >= 0.5 ? 1 : 0;
      if (pred === s.label) correct++;
    }

    const model = {
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

    await client.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [MODEL_SETTINGS_KEY, JSON.stringify(model)]
    );

    console.log(`✅ Model trained and saved (version ${model.version})`);
    console.log(`   Samples: ${model.samples.total} (${model.samples.positive} positive / ${model.samples.negative} negative)`);
    console.log(`   Accuracy: ${(model.metrics.accuracy * 100).toFixed(1)}%  Loss: ${model.metrics.loss.toFixed(4)}`);
    console.log("   Architecture: neural network (8 + 4 hidden neurons, leaky-relu)");
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Training failed:", err);
  process.exit(1);
});
