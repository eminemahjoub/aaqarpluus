export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  requireRole,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * GET /api/zatca/invoices — list invoices for the caller's office
 * (admins see all; a ?office_id param narrows for admins).
 * Supports ?from and ?to date filters (ISO dates).
 */
export const GET = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireRole(ctx, "admin", "manager");
    return ctx;
  },
  async (ctx, req) => {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const officeId = ctx.role === "admin" ? url.searchParams.get("office_id") : ctx.officeId;
    if (!officeId) return ok({ invoices: [] });

    const ds = await getDataSource();
    const params: unknown[] = [officeId];
    let where = "WHERE office_id = $1";
    if (from) {
      params.push(from);
      where += ` AND generated_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND generated_at <= $${params.length}`;
    }

    const rows = await ds.query(
      `SELECT id, invoice_number, generated_at, total_amount, vat_amount, status
         FROM zatca_invoices
         ${where}
        ORDER BY generated_at DESC`,
      params
    );

    return ok({
      invoices: (rows ?? []).map((r: any) => ({
        id: String(r.id),
        invoice_number: String(r.invoice_number),
        generated_at: r.generated_at,
        total_amount: Number(r.total_amount) || 0,
        vat_amount: Number(r.vat_amount) || 0,
        status: String(r.status ?? "generated"),
      })),
    });
  }
);