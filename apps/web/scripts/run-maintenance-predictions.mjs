// Predictive Maintenance batch runner.
// Usage: node --env-file .env.local scripts/run-maintenance-predictions.mjs
// Mirrors the scoring logic of src/lib/maintenance/predictor.ts (kept in sync manually,
// like the .mjs migration scripts mirror the TypeORM migrations).

import pg from "pg";

const { Pool } = pg;

const BATCH_LIMIT = Number(process.env.MAINTENANCE_PREDICTION_BATCH_SIZE ?? 100);
const CRITICAL_THRESHOLD = Number(process.env.MAINTENANCE_CRITICAL_THRESHOLD ?? 75);
const HIGH_THRESHOLD = Number(process.env.MAINTENANCE_HIGH_THRESHOLD ?? 50);

const SUGGESTED_ACTIONS = {
  ac: "صيانة دورية لمكيف الهواء - فحص ضغط الفريون وتنظيف الفلاتر",
  plumbing: "فحص شامل لشبكة السباكة - تفقد التسريبات وضغط المياه",
  electrical: "فحص كهربائي شامل - تفقد القواطع والتوصيلات",
  general: "صيانة دورية شاملة للوحدة",
};

const ESTIMATED_COSTS = { ac: 600, plumbing: 450, electrical: 525, general: 500 };

const pool = new Pool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "property_crm",
});

function monthsBetween(a, b) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function riskLevelFromScore(score) {
  if (score > CRITICAL_THRESHOLD) return "critical";
  if (score > HIGH_THRESHOLD) return "high";
  if (score > 25) return "medium";
  return "low";
}

function computeRisk(unit) {
  const now = new Date();
  let ac = 0;
  let plumbing = 0;
  let electrical = 0;
  const factors = [];

  const created = unit.property_created_at ? new Date(unit.property_created_at) : null;
  const rawAge = unit.building_age ?? (created ? (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0);
  const age = Number.isFinite(rawAge) ? rawAge : 0;

  const agePoints = age > 5 ? Math.min(30, Math.round((age - 5) * 5)) : 0;
  if (agePoints > 0) {
    factors.push({ name: "building_age", points: agePoints });
    ac += agePoints;
    plumbing += agePoints;
    electrical += agePoints;
  }

  const acDate = unit.last_ac_service_date ? new Date(unit.last_ac_service_date) : null;
  const plumbingDate = unit.last_plumbing_check_date ? new Date(unit.last_plumbing_check_date) : null;
  const electricalDate = unit.last_electrical_check_date ? new Date(unit.last_electrical_check_date) : null;

  let acPts = 0;
  if (!acDate) acPts = 20;
  else {
    const m = monthsBetween(acDate, now);
    if (m > 12) acPts = 20;
    else if (m > 6) acPts = 10;
  }
  if (acPts > 0) {
    factors.push({ name: "ac_recency", points: acPts });
    ac += acPts;
  }

  let plPts = 0;
  if (!plumbingDate || monthsBetween(plumbingDate, now) > 18) plPts = 15;
  if (plPts > 0) {
    factors.push({ name: "plumbing_recency", points: plPts });
    plumbing += plPts;
  }

  let elPts = 0;
  if (!electricalDate || monthsBetween(electricalDate, now) > 24) elPts = 15;
  if (elPts > 0) {
    factors.push({ name: "electrical_recency", points: elPts });
    electrical += elPts;
  }

  const month = now.getMonth();
  const isSummer = month >= 4 && month <= 6;
  const isWinter = month === 11 || month === 0 || month === 1;
  if (isSummer && age > 3) {
    factors.push({ name: "seasonal_ac", points: 15 });
    ac += 15;
  }
  if (isWinter && age > 5) {
    factors.push({ name: "seasonal_plumbing", points: 10 });
    plumbing += 10;
  }

  // Historical failure pattern from stored predictions
  for (const h of unit.history ?? []) {
    const pts = Math.min(h.cnt, 5) * 10;
    factors.push({ name: `hist_${h.type}`, points: pts });
    if (h.type === "ac") ac += pts;
    else if (h.type === "plumbing") plumbing += pts;
    else if (h.type === "electrical") electrical += pts;
    else {
      ac += pts;
      plumbing += pts;
      electrical += pts;
    }
  }

  if (unit.is_high_usage) {
    factors.push({ name: "occupancy", points: 5 });
    ac += 5;
    plumbing += 5;
    electrical += 5;
  }

  const modelType = String(unit.property_model_type ?? "").toLowerCase();
  let typePts = 0;
  if (modelType.includes("villa")) typePts = 10;
  else if (modelType.includes("studio")) typePts = 3;
  else if (modelType.includes("apartment")) typePts = 5;
  if (typePts > 0) {
    factors.push({ name: "property_type", points: typePts });
    ac += typePts;
    plumbing += typePts;
    electrical += typePts;
  }

  const riskScore = clamp(Math.round(ac + plumbing + electrical), 0, 100);
  const riskLevel = riskLevelFromScore(riskScore);

  const maxType = Math.max(ac, plumbing, electrical);
  let predictedFailureType = "general";
  if (maxType > 0) {
    if (ac === maxType) predictedFailureType = "ac";
    else if (plumbing === maxType) predictedFailureType = "plumbing";
    else if (electrical === maxType) predictedFailureType = "electrical";
  }

  let predictedFailureDate = null;
  if (riskScore > CRITICAL_THRESHOLD) predictedFailureDate = new Date(now.getTime() + 14 * 86400000);
  else if (riskScore > HIGH_THRESHOLD) predictedFailureDate = new Date(now.getTime() + 30 * 86400000);
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

function toDateOnly(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function main() {
  const client = await pool.connect();
  let predicted = 0;
  let tasksCreated = 0;
  let notificationsSent = 0;
  let errors = 0;

  try {
    // Units with an active contract
    const unitsRes = await client.query(
      `SELECT DISTINCT
         u.id, u.label, u.property_id, u.unit_type,
         u.last_ac_service_date, u.last_plumbing_check_date, u.last_electrical_check_date,
         p.name AS property_name, p.property_model_type, p.created_at AS property_created_at,
         p.managing_office_id, p.created_by_agency_id, p.owner_id,
         (c.start_date IS NOT NULL AND c.start_date <= (CURRENT_DATE - INTERVAL '6 months')) AS is_high_usage
       FROM units u
       JOIN contracts c ON c.unit_id = u.id AND c.deleted_at IS NULL AND c.status = 'active'
       JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
       LIMIT $1`,
      [BATCH_LIMIT]
    );
    const units = unitsRes.rows ?? [];

    console.log(`🔧 Processing ${units.length} unit(s) with active contracts...`);

    for (const unit of units) {
      try {
        const unitId = String(unit.id);

        // Historical failure pattern (last 12 months)
        const histRes = await client.query(
          `SELECT predicted_failure_type AS type, COUNT(*)::int AS cnt
           FROM maintenance_predictions
           WHERE unit_id = $1 AND prediction_date >= (CURRENT_DATE - INTERVAL '12 months')
           GROUP BY predicted_failure_type`,
          [unitId]
        );
        unit.history = histRes.rows ?? [];

        const result = computeRisk(unit);

        // Save prediction
        await client.query(
          `INSERT INTO maintenance_predictions (
             unit_id, prediction_date, risk_score, risk_level,
             predicted_failure_type, predicted_failure_date,
             suggested_action, estimated_cost_sar, is_resolved
           ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, false)`,
          [
            unitId,
            result.riskScore,
            result.riskLevel,
            result.predictedFailureType,
            toDateOnly(result.predictedFailureDate),
            result.suggestedAction,
            result.estimatedCostSar,
          ]
        );

        // Keep unit risk snapshot in sync
        await client.query(
          `UPDATE units SET maintenance_risk_score = $2, maintenance_risk_level = $3, updated_at = NOW() WHERE id = $1`,
          [unitId, result.riskScore, result.riskLevel]
        );
        predicted++;

        if (result.riskLevel === "high" || result.riskLevel === "critical") {
          // Avoid duplicate tasks: unresolved maintenance task for this unit in last 7 days
          const dupRes = await client.query(
            `SELECT 1 FROM tasks
             WHERE deleted_at IS NULL AND unit_id = $1 AND type = 'maintenance'
               AND status != 'done' AND created_at >= NOW() - INTERVAL '7 days'
             LIMIT 1`,
            [unitId]
          );
          if ((dupRes.rows ?? []).length === 0) {
            const officeId = unit.managing_office_id ?? unit.created_by_agency_id ?? null;
            const dueDate = toDateOnly(result.predictedFailureDate) ?? toDateOnly(new Date(Date.now() + 7 * 86400000));
            const title = `صيانة وقائية - ${unit.property_name || "عقار"}${unit.label ? ` - وحدة ${unit.label}` : ""}`;
            const description = `${result.suggestedAction} (درجة الخطورة: ${result.riskScore})`;
            const priority = result.riskLevel === "critical" ? "high" : "medium";

            await client.query(
              `INSERT INTO tasks (
                 owner_id, property_id, unit_id, type, title, description,
                 due_date, status, priority, cost_sar, extra, created_at, updated_at
               ) VALUES ($1, $2, $3, 'maintenance', $4, $5, $6, 'pending', $7, $8, $9, NOW(), NOW())`,
              [
                unit.owner_id,
                unit.property_id,
                unitId,
                title,
                description,
                dueDate,
                priority,
                result.estimatedCostSar ?? 0,
                JSON.stringify({ source: "maintenance_ai", office_id: officeId, risk_level: result.riskLevel, risk_score: result.riskScore }),
              ]
            );
            tasksCreated++;

            // Notify agency owner (office_id on user_type='agency')
            const ownerRes = await client.query(
              `SELECT id FROM users
               WHERE office_id = $1 AND user_type = 'agency' AND is_active AND deleted_at IS NULL
               LIMIT 1`,
              [officeId ?? "00000000-0000-0000-0000-000000000000"]
            );
            const agencyOwnerId = (ownerRes.rows ?? [])[0]?.id;
            if (agencyOwnerId) {
              await client.query(
                `INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type, is_read, created_at)
                 VALUES ($1, 'maintenance_alert', 'تنبيه صيانة وقائية', $2, $3, 'unit', false, NOW())`,
                [
                  agencyOwnerId,
                  `الوحدة ${unit.label ?? ""} تحتاج صيانة وقائية: ${result.suggestedAction}`,
                  unitId,
                ]
              );
              notificationsSent++;
            }
          }
        }
      } catch (err) {
        errors++;
        console.error("Failed for unit:", unit.id, err instanceof Error ? err.message : err);
      }
    }

    console.log(`✅ Predictions saved: ${predicted}`);
    console.log(`✅ Tasks created: ${tasksCreated}`);
    console.log(`✅ Notifications sent: ${notificationsSent}`);
    if (errors > 0) console.log(`⚠️ Errors: ${errors}`);
  } catch (err) {
    console.error("❌ Batch failed:", err);
    process.exitCode = 1;
  } finally {
    await client.release();
    await pool.end();
  }
}

main();
