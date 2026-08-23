export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";
import {
  withAuth,
  resolveContext,
  requireRole,
  type UserContext,
} from "@/lib/auth/scope";
import { generateZATCAXML } from "@/lib/zatca";
import { signInvoiceXml } from "@/lib/zatca/sign";
import { submitToZatca } from "@/lib/zatca/submit";

/**
 * POST /api/zatca/invoices/[id]/zatca-submit — admin-only manual submission.
 *
 * Currently returns 500 "awaiting CSID credentials" (the stubs throw until
 * ZATCA credentials are configured). Once un-stubbed: sign → submit → record
 * the ZATCA tracking fields on the invoice row.
 */
export const POST = withAuth<UserContext, { id: string }>(
  async () => {
    const ctx = await resolveContext();
    requireRole(ctx, "admin");
    return ctx;
  },
  async (ctx, _req, { params }) => {
    const { id } = await params;
    const ds = await getDataSource();

    const rows = await ds.query(
      `SELECT * FROM zatca_invoices WHERE id = $1 LIMIT 1`,
      [id]
    );
    const invoice = rows?.[0];
    if (!invoice) {
      return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);
    }
    if (invoice.status === "reported") {
      return jsonResponse({ error: "تم الإبلاغ مسبقاً", code: "CONFLICT" }, 409);
    }

    try {
      const data = {
        invoice_number: String(invoice.invoice_number),
        invoice_timestamp: String(invoice.generated_at ?? new Date().toISOString()),
        seller_name: String(invoice.seller_name),
        seller_vat: invoice.seller_vat ?? undefined,
        buyer_name: String(invoice.buyer_name ?? ""),
        total_amount: Number(invoice.total_amount) || 0,
        vat_amount: Number(invoice.vat_amount) || 0,
        vat_rate: Number(invoice.vat_rate) || 0.15,
        payment_method: String(invoice.payment_method ?? "cash"),
      };
      const unsignedXml = generateZATCAXML(data);
      const { signedXml, invoiceHash, qrCode, uuid } = await signInvoiceXml(unsignedXml);
      const result = await submitToZatca(signedXml, invoiceHash);

      await ds.query(
        `UPDATE zatca_invoices
            SET status = $1,
                zatca_report_id = $2,
                zatca_invoice_hash = $3,
                zatca_signed_xml = $4,
                zatca_submitted_at = NOW(),
                zatca_response_raw = $5::jsonb,
                zatca_retry_count = zatca_retry_count + 1
          WHERE id = $6`,
        [
          result.status,
          result.reportId,
          invoiceHash,
          signedXml,
          JSON.stringify(result.rawResponse),
          id,
        ]
      );
      void qrCode;
      void uuid;

      return jsonResponse({ status: result.status, reportId: result.reportId }, 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[zatca-submit] failed:", msg);
      return jsonResponse({ error: "فشل الإرسال", detail: msg }, 500);
    }
  }
);