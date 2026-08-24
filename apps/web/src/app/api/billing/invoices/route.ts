export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  type UserContext,
} from "@/lib/auth/scope";
import { getOfficePlan } from "@/lib/billing/plans";
import { countOfficeUnits } from "@/lib/billing/enforce";

/**
 * GET /api/billing/invoices — the office's billing summary: current plan,
 * unit usage vs limit, trial window, and SaaS invoice history.
 */
export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx) => {
    if (!ctx.officeId) throw badRequest("لا يوجد مكتب مرتبط بحسابك");

    const ds = await getDataSource();
    const plan = await getOfficePlan(ctx.officeId);
    const units = await countOfficeUnits(ctx.officeId);

    const invoices = await ds.query(
      `SELECT i.id, i.plan_id, i.amount_sar, i.tax_sar, i.total_sar, i.status,
              i.paid_at, i.due_date, i.zatca_invoice_id, z.invoice_number AS zatca_number
         FROM saas_invoices i
         LEFT JOIN zatca_invoices z ON z.id = i.zatca_invoice_id
        WHERE i.office_id = $1
        ORDER BY i.created_at DESC
        LIMIT 50`,
      [ctx.officeId]
    );

    return ok({
      plan: {
        id: plan.planId,
        name_ar: plan.nameAr,
        price_sar: plan.priceSar,
        unit_limit: plan.unitLimit,
        status: plan.status,
        trial_ends_at: plan.trialEndsAt,
        period_ends_at: plan.periodEndsAt,
      },
      usage: { units },
      invoices: (invoices ?? []).map((r: any) => ({
        id: String(r.id),
        plan_id: r.plan_id,
        amount_sar: Number(r.amount_sar) || 0,
        tax_sar: Number(r.tax_sar) || 0,
        total_sar: Number(r.total_sar) || 0,
        status: r.status ?? "draft",
        paid_at: r.paid_at,
        due_date: r.due_date,
        zatca_number: r.zatca_number ?? null,
        zatca_invoice_id: r.zatca_invoice_id ?? null,
      })),
    });
  }
);