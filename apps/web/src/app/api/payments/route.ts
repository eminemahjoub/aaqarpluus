export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  assertPropertyAccess,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * GET /api/payments?property_id=... — paid-only payment history for a
 * property, across ALL its contracts (active and ended), newest first.
 *
 * Pure read, no mutation. Scoped via assertPropertyAccess (same 404
 * semantics for missing vs unauthorized).
 */
export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx, req) => {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("property_id");
    if (!propertyId) {
      return ok({ payments: [] });
    }
    await assertPropertyAccess(ctx, propertyId);

    const ds = await getDataSource();
    // cp.id = payment id (used for the PDF receipt link), receipt resolved
    // via the standard category/file_name convention.
    const rows = await ds.query(
      `SELECT cp.id,
              cp.amount_sar,
              cp.payment_method,
              cp.paid_at,
              u.label AS unit_label,
              d.public_url AS receipt_url
         FROM contract_payments cp
         JOIN contracts c ON c.id = cp.contract_id
         LEFT JOIN units u ON u.id = c.unit_id
         LEFT JOIN LATERAL (
           SELECT doc.public_url
             FROM documents doc
            WHERE doc.category = 'payment_receipt'
              AND doc.contract_id = c.id
              AND doc.file_name LIKE 'receipt_' || cp.id || '_%'
              AND doc.deleted_at IS NULL
            ORDER BY doc.created_at DESC
            LIMIT 1
         ) d ON TRUE
        WHERE c.property_id = $1
          AND c.deleted_at IS NULL
          AND cp.status = 'paid'
        ORDER BY cp.paid_at DESC`,
      [propertyId]
    );

    return ok({
      payments: (rows ?? []).map((r: any) => ({
        id: String(r.id),
        amount_sar: Number(r.amount_sar) || 0,
        payment_method: r.payment_method ?? "cash",
        paid_at: r.paid_at,
        unit_label: r.unit_label ? String(r.unit_label) : null,
        receipt_url: r.receipt_url ? String(r.receipt_url) : null,
      })),
    });
  }
);