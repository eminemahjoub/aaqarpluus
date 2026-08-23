export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";
import {
  withAuth,
  resolveContext,
  requireRole,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * GET /api/zatca/invoices/[id]/qr — Base64 ZATCA QR payload.
 * Admin or office-scoped access.
 */
export const GET = withAuth<UserContext, { id: string }>(
  async (_req, { params }) => {
    const ctx = await resolveContext();
    requireRole(ctx, "admin", "manager");
    void params;
    return ctx;
  },
  async (ctx, _req, { params }) => {
    const { id } = await params;
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT office_id, qr_payload FROM zatca_invoices WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = rows?.[0];
    const allowed = ctx.role === "admin" || (ctx.officeId !== null && String(row?.office_id ?? "") === ctx.officeId);
    if (!row || !allowed) {
      return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);
    }
    return new Response(String(row.qr_payload ?? ""), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
);