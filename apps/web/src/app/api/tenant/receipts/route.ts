export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, unauthorized, serverError } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";

/**
 * GET /api/tenant/receipts — paid-installment receipts for the logged-in
 * tenant (PIN-based tenant JWT; not staff auth).
 *
 * Receipt documents are stored with category = 'payment_receipt',
 * contract_id, and file_name LIKE 'receipt_<paymentId>_%' — the documents
 * table has no scope_type/scope_id columns, so the LATERAL join below
 * resolves each payment's receipt URL via that convention.
 */

const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  card: "بطاقة",
  other: "أخرى",
};

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) return unauthorized();

    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT cp.id,
              cp.amount_sar,
              cp.paid_at,
              cp.payment_method,
              u.label  AS unit_label,
              COALESCE(NULLIF(p.title, ''), p.name) AS property_title,
              p.city   AS property_city,
              d.public_url AS receipt_url
         FROM contract_payments cp
         JOIN contracts c ON c.id = cp.contract_id
         LEFT JOIN units u ON u.id = c.unit_id
         LEFT JOIN properties p ON p.id = c.property_id
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
        WHERE c.contact_id = $1
          AND c.deleted_at IS NULL
          AND cp.status = 'paid'
        ORDER BY cp.paid_at DESC`,
      [tenant.tenantId]
    );

    const receipts = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      amount_sar: Number(r.amount_sar) || 0,
      paid_at: r.paid_at,
      payment_method: PAYMENT_METHOD_AR[String(r.payment_method ?? "other")] ?? "أخرى",
      unit_label: r.unit_label ? String(r.unit_label) : null,
      property_title: r.property_title ? String(r.property_title) : "—",
      property_city: r.property_city ? String(r.property_city) : null,
      receipt_url: r.receipt_url ? String(r.receipt_url) : null,
    }));

    return ok(receipts);
  } catch (err) {
    return serverError(err);
  }
}
