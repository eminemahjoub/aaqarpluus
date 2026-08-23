export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest } from "@/lib/api-helpers";
import { jsonResponse, AppError } from "@/lib/errors";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";
import { resolveContext, assertPropertyAccess } from "@/lib/auth/scope";
import { createPaymentReceiptPdfBytes } from "@/lib/receipt-pdf";

/**
 * GET /api/receipts/[id]/pdf — receipt PDF with dual auth:
 *  1. Staff (JWT): property-level access via assertPropertyAccess
 *     (office_property_links for agencies, ownership for owners, admin bypass).
 *  2. Tenant (PIN JWT): only their own contract's payments
 *     (payment.contract.contact_id === tenant.tenantId).
 * Only paid payments expose a receipt; anything else is 404 (IDOR-safe).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await getDataSource();

    const payment = await ds.getRepository("ContractPayment").findOne({ where: { id } as any });
    if (!payment || String((payment as any).status) !== "paid") {
      return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);
    }

    const contract = await ds.getRepository("Contract").findOne({
      where: { id: (payment as any).contract_id } as any,
      relations: ["contact", "property", "unit"],
    });
    if (!contract) return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);

    const user = await getUserFromRequest(req);
    if (user) {
      // Staff path: property-level access (agency office links / owner / admin)
      const ctx = await resolveContext();
      const propertyId = (contract as any).property_id ? String((contract as any).property_id) : null;
      if (!propertyId) return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);
      await assertPropertyAccess(ctx, propertyId);
    } else {
      const tenant = await getTenantFromRequest(req);
      if (!tenant) return jsonResponse({ error: "غير مصرح", code: "UNAUTHORIZED" }, 401);
      if (String((contract as any).contact_id) !== String(tenant.tenantId)) {
        return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);
      }
    }

    const zatcaRows = await ds.query(
      `SELECT qr_payload FROM zatca_invoices WHERE payment_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [id]
    );
    const pdfBytes = await createPaymentReceiptPdfBytes({
      contract,
      payment,
      zatcaQR: zatcaRows?.[0]?.qr_payload ? String(zatcaRows[0].qr_payload) : undefined,
    });
    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-${id}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    console.error("[receipts pdf] error:", err);
    return jsonResponse({ error: "خطأ في الخادم", code: "INTERNAL" }, 500);
  }
}
