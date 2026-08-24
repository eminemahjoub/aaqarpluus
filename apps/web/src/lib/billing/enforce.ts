import { getDataSource } from "@/lib/db/data-source";
import { AuthError } from "@/lib/auth/scope";
import { getOfficePlan } from "@/lib/billing/plans";

/** Hard gate: feature not in the plan → 403 upgrade_required. */
export async function assertPlanFeature(
  officeId: string | null | undefined,
  feature: string
): Promise<void> {
  if (!officeId) return;
  const plan = await getOfficePlan(officeId);
  if (!plan.features[feature]) {
    const err = new AuthError("ميزة غير متاحة في باقتك الحالية", 403);
    (err as any).details = { code: "upgrade_required", feature, current_plan: plan.planId };
    throw err;
  }
}

/** Unit-limit gate for property/unit creation. countAfter = existing + requested. */
export async function assertUnitLimit(
  officeId: string | null | undefined,
  countAfter: number
): Promise<void> {
  if (!officeId) return;
  const plan = await getOfficePlan(officeId);
  if (plan.unitLimit !== null && countAfter > plan.unitLimit) {
    const err = new AuthError("تجاوزت الحد المسموح للوحدات في باقتك", 403);
    (err as any).details = {
      code: "limit_reached",
      limit: plan.unitLimit,
      current: countAfter,
      requested: 1,
      current_plan: plan.planId,
    };
    throw err;
  }
}

/**
 * Active-subscription gate: trialing/active pass; past_due allows a 7-day
 * grace; cancelled/expired beyond the period end block.
 */
export async function assertActiveSubscription(
  officeId: string | null | undefined
): Promise<void> {
  if (!officeId) return;
  const plan = await getOfficePlan(officeId);
  if (!plan.status) return; // free-by-default (no row)
  const status = plan.status;
  if (status === "trialing" || status === "active") return;

  if (status === "past_due") {
    if (plan.periodEndsAt && new Date(plan.periodEndsAt) > new Date(Date.now() + 7 * 864e5)) return;
    throw new AuthError("اشتراكك متأخر السداد — يرجى تحديث طريقة الدفع", 403);
  }

  if (status === "cancelled") {
    if (plan.periodEndsAt && new Date(plan.periodEndsAt) > new Date()) return;
    throw new AuthError("الاشتراك ملغي", 403);
  }

  throw new AuthError("الاشتراك غير نشط", 403);
}

/** Current unit count across the office's properties. */
export async function countOfficeUnits(officeId: string): Promise<number> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT COUNT(*)::int AS c
       FROM units u
       JOIN properties p ON p.id = u.property_id
      WHERE p.deleted_at IS NULL
        AND (p.managing_office_id = $1
             OR EXISTS (SELECT 1 FROM office_property_links l WHERE l.office_id = $1 AND l.property_id = p.id))`,
    [officeId]
  );
  return Number(rows?.[0]?.c) || 0;
}