export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserFromRequest, unauthorized, badRequest, ok, serverError } from "@/lib/api-helpers";
import { getDataSource } from "@/lib/db/data-source";

// ---------------------------------------------------------------------------
// AI smart report: sends a prediction + unit context to an LLM and returns a
// professional Arabic maintenance report with prioritized actions.
// Provider-agnostic: uses Cerebras (default, cheapest) or OpenAI.
//   • CEREBRAS_API_KEY set  → https://api.cerebras.ai/v1  (model: AI_MODEL or gpt-oss-120b)
//   • OPENAI_API_KEY set    → https://api.openai.com/v1   (model: AI_MODEL or gpt-4o-mini)
// Falls back gracefully when no key is configured.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  predictionId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
});

interface AiReport {
  summary: string;
  factors: string[];
  recommendedActions: string[];
  estimatedCostSar: number | null;
  urgentInDays: number | null;
}

function resolveProvider(): { baseUrl: string; model: string } | null {
  if (process.env.CEREBRAS_API_KEY) {
    return { baseUrl: "https://api.cerebras.ai/v1", model: process.env.AI_MODEL ?? "gpt-oss-120b" };
  }
  if (process.env.OPENAI_API_KEY) {
    return { baseUrl: "https://api.openai.com/v1", model: process.env.AI_MODEL ?? "gpt-4o-mini" };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const provider = resolveProvider();
    if (!provider) {
      return ok({ ok: false, reason: "نموذج تقارير الذكاء الاصطناعي غير مفعّل — أضف CEREBRAS_API_KEY أو OPENAI_API_KEY في .env.local" });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("بيانات غير صالحة");
    const { predictionId } = parsed.data;

    const ds = await getDataSource();

    const predictionRows = await ds.query(
      `SELECT p.*, u.label AS unit_name, u.last_ac_service_date, u.last_plumbing_check_date, u.last_electrical_check_date,
              pr.name AS property_name, pr.property_model_type, pr.created_at AS property_created_at,
              pr.city, pr.neighborhood
       FROM maintenance_predictions p
       JOIN units u ON u.id = p.unit_id
       LEFT JOIN properties pr ON pr.id = u.property_id
       WHERE p.id = $1 AND p.prediction_date >= CURRENT_DATE - INTERVAL '90 days'`,
      [predictionId ?? ""]
    );
    const prediction = predictionRows?.[0];
    if (!prediction) return badRequest("التنبؤ غير موجود");

    const ctx: Record<string, unknown> = {
      unit: prediction.unit_name ?? "وحدة سكنية",
      property: prediction.property_name ?? null,
      city: [prediction.city, prediction.neighborhood].filter(Boolean).join(" — ") || null,
      propertyModelType: prediction.property_model_type ?? null,
      buildingAgeYears:
        prediction.property_created_at
          ? Math.round((Date.now() - new Date(prediction.property_created_at).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
          : null,
      riskScore: prediction.risk_score,
      riskLevel: prediction.risk_level,
      predictedFailureType: prediction.predicted_failure_type,
      predictedFailureDate: prediction.predicted_failure_date,
      suggestedAction: prediction.suggested_action,
      estimatedCostSar: prediction.estimated_cost_sar,
      lastAcServiceDate: prediction.last_ac_service_date,
      lastPlumbingCheckDate: prediction.last_plumbing_check_date,
      lastElectricalCheckDate: prediction.last_electrical_check_date,
      resolved: prediction.is_resolved,
    };

    const system = `أنت مهندس صيانة مباني خبير باللغة العربية الفصحى. تحلل تنبؤًا باحتمال تعطل وحدة سكنية في نظام إدارة عقارات سعودي.
أنتِج تقريرًا احترافيًا منسقًا على شكل JSON فقط (بدون markdown) بهذا الشكل:
{
  "summary": "ملخص 2-3 جمل يشرح الوضع ولماذا الوحدة معرضة للخطر",
  "factors": ["العامل الأهم أولًا — كل عنصر عبارة عن جملة عربية واضحة تشرح سببه"],
  "recommendedActions": ["إجراءات مقترحة مرتبة حسب الأولوية، محددة وقابلة للتنفيذ"],
  "estimatedCostSar": "تقدير التكلفة بالريال كرقم أو null إذا لم يمكن تقديره",
  "urgentInDays": "خلال كم يوم يجب التدخل كرقم أو null"
}
لا تختلق أرقامًا غير مدعومة بالبيانات المقدمة. استخدم المصطلحات الهندسية المناسبة (تكييف، شبكة سباكة، شبكة كهرباء، تمديدات).`;

    const userMsg = `التنبؤ: خطر ${ctx.riskLevel} (درجة ${ctx.riskScore}/100)، نوع العطل المتوقع: ${ctx.predictedFailureType}${ctx.predictedFailureDate ? `، التاريخ المتوقع: ${ctx.predictedFailureDate}` : ""}.
الإجراء المقترح حاليًا: ${ctx.suggestedAction}${ctx.estimatedCostSar ? ` (تكلفة تقديرية ${ctx.estimatedCostSar} ريال)` : ""}.
الوحدة: ${ctx.unit}${ctx.property ? ` في ${ctx.property}` : ""}${ctx.city ? ` (${ctx.city})` : ""}، نوع العقار: ${ctx.propertyModelType ?? "غير محدد"}${ctx.buildingAgeYears != null ? `، عمر المبنى ${ctx.buildingAgeYears} سنة` : ""}.
آخر خدمة مكيف: ${ctx.lastAcServiceDate ?? "غير مسجلة"} — آخر فحص سباكة: ${ctx.lastPlumbingCheckDate ?? "غير مسجل"} — آخر فحص كهرباء: ${ctx.lastElectricalCheckDate ?? "غير مسجل"}.
أعد تقريرك بالعربية.`;

    const apiKey = provider.baseUrl.includes("cerebras") ? process.env.CEREBRAS_API_KEY : process.env.OPENAI_API_KEY;
    const llmRes = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!llmRes.ok) {
      // Surface a friendly Arabic reason instead of a bare 500
      let providerMsg = `استجاب مزود الذكاء الاصطناعي برمز ${llmRes.status}`;
      try {
        const errJson = await llmRes.json();
        providerMsg = String(errJson?.error?.message ?? errJson?.message ?? providerMsg);
      } catch {
        // ignore unparseable error body
      }
      if (llmRes.status === 402 || llmRes.status === 403 || /payment|billing|quota|insufficient/i.test(providerMsg)) {
        return ok({ ok: false, reason: "حساب مزود الذكاء الاصطناعي (Cerebras) غير مفعّل للدفع — أضف رصيدًا أو وسيلة دفع في لوحة Cerebras ثم أعد المحاولة" });
      }
      if (llmRes.status === 401) {
        return ok({ ok: false, reason: "مفتاح الذكاء الاصطناعي غير صحيح — تحقق من CEREBRAS_API_KEY في .env.local" });
      }
      if (llmRes.status === 429) {
        return ok({ ok: false, reason: "تجاوزت حد الاستخدام المؤقت — أعد المحاولة بعد قليل" });
      }
      return serverError(new Error(`LLM provider responded ${llmRes.status}: ${providerMsg}`));
    }
    const llmJson = await llmRes.json();
    const content = llmJson?.choices?.[0]?.message?.content;
    if (!content) return serverError(new Error("LLM provider returned no content"));

    let report: AiReport;
    try {
      report = JSON.parse(content);
    } catch {
      report = { summary: content, factors: [], recommendedActions: [], estimatedCostSar: null, urgentInDays: null };
    }

    return ok({
      ok: true,
      predictionId,
      report,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err);
  }
}
