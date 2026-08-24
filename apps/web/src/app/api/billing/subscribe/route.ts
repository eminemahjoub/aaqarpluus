export const dynamic = "force-dynamic";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  requireRole,
  type UserContext,
} from "@/lib/auth/scope";
import { generateSaaSInvoice } from "@/lib/billing/invoice";

const SubscribeSchema = z.object({
  plan_id: z.enum(["starter", "growth", "pro"]),
  payment_token: z.string().optional(),
  is_yearly: z.boolean().optional(),
});

/**
 * POST /api/billing/subscribe — agency-only. Starts a 14-day trial on paid
 * plans (no card required); Pro bills per unit at renewal.
 */
export const POST = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireRole(ctx, "manager", "admin");
    return ctx;
  },
  async (ctx, req) => {
    if (!ctx.officeId) throw badRequest("لا يوجد مكتب مرتبط بحسابك");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("البيانات مطلوبة");
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) throw badRequest(parsed.error.issues?.[0]?.message ?? "بيانات غير صحيحة");

    const { plan_id, is_yearly } = parsed.data;
    const isYearly = Boolean(is_yearly);

    const ds = await getDataSource();
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 864e5);
    const periodEndsAt = is_yearly
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getTime() + 30 * 864e5);

    // deactivate old subs for this office, then create the trial
    await ds.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'replaced' WHERE office_id = $1 AND status IN ('trialing','active')`,
      [ctx.officeId]
    );
    const sub = await ds.query(
      `INSERT INTO subscriptions
         (office_id, user_id, plan, status, start_date, trial_ends_at, current_period_starts_at, current_period_ends_at, payment_method, created_at, updated_at)
       VALUES ($1, $2, $3, 'trialing', CURRENT_DATE, $4, NOW(), $5, $6, NOW(), NOW())
       RETURNING id`,
      [ctx.officeId, ctx.userId, plan_id, trialEndsAt.toISOString(), periodEndsAt.toISOString(), "tap"]
    );
    const subId = String(sub?.[0]?.id) ?? null;

    // SaaS invoice for the upcoming period (paid on first success; open now)
    let invoiceId: string | null = null;
    try {
      const { getOfficePlan } = await import("@/lib/billing/plans");
      const plan = await getOfficePlan(ctx.officeId);
      const { countOfficeUnits } = await import("@/lib/billing/enforce");
      const units = await countOfficeUnits(ctx.officeId);
      invoiceId = await generateSaaSInvoice({
        officeId: ctx.officeId,
        subscriptionId: subId,
        plan,
        isYearly,
        unitCount: units,
      });
    } catch (err) {
      console.error("[billing] saas invoice failed:", err);
    }

    return ok({
      subscription: { id: subId, plan_id, status: "trialing", trial_ends_at: trialEndsAt.toISOString() },
      invoice_id: invoiceId,
      message: "بدأت فترة التجربة — 14 يوماً بدون بطاقة",
    });
  }
);