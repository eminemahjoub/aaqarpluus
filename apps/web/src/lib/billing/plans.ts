import { getDataSource } from "@/lib/db/data-source";

export interface OfficePlan {
  planId: string;
  nameAr: string;
  nameEn: string;
  priceSar: number;
  unitLimit: number | null;
  features: Record<string, boolean>;
  status: string | null;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
}

const FREE_PLAN = {
  features: {
    contracts: true, payments: true, documents: true, reports: true,
    ejar: false, zatca: false, sms: false, owner_portal: false, api: false, branding: false,
  },
};

/**
 * Resolves the office's effective plan. Defaults to Free when no
 * subscription row exists (new agencies start on Free).
 */
export async function getOfficePlan(officeId: string): Promise<OfficePlan> {
  const ds = await getDataSource();
  const sub = await ds.query(
    `SELECT s.*, p.name_ar, p.name_en, p.price_sar, p.unit_limit, p.features
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan
      WHERE s.office_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1`,
    [officeId]
  );
  const s = sub?.[0];
  if (!s) {
    return {
      planId: "free", nameAr: "مجاني", nameEn: "Free", priceSar: 0,
      unitLimit: 3, features: FREE_PLAN.features, status: null,
      trialEndsAt: null, periodEndsAt: null,
    };
  }
  return {
    planId: String(s.plan),
    nameAr: String(s.name_ar),
    nameEn: String(s.name_en),
    priceSar: Number(s.price_sar) || 0,
    unitLimit: s.unit_limit != null ? Number(s.unit_limit) : null,
    features: (s.features && typeof s.features === "object" ? s.features : FREE_PLAN.features) as Record<string, boolean>,
    status: String(s.status ?? null),
    trialEndsAt: s.trial_ends_at ?? null,
    periodEndsAt: s.current_period_ends_at ?? null,
  };
}

export async function hasPlanFeature(officeId: string | null | undefined, feature: string): Promise<boolean> {
  if (!officeId) return true; // non-office actors (owners) are not plan-gated at the core level
  const plan = await getOfficePlan(officeId);
  return Boolean(plan.features[feature]);
}