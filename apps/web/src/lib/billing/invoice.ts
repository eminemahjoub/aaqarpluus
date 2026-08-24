import { getDataSource } from "@/lib/db/data-source";
import { generateInvoiceNumber, generateZATCAQR, generateZATCAXML, type ZATCAInvoiceData } from "@/lib/zatca";
import type { OfficePlan } from "@/lib/billing/plans";

/**
 * SaaS invoice generation (what WE charge agencies), reusing the existing
 * ZATCA foundation: sequential invoice number + TLV QR + UBL XML row.
 * Submission stays pending until CSID credentials arrive.
 */
export async function generateSaaSInvoice({
  officeId,
  subscriptionId,
  plan,
  isYearly,
  unitCount,
}: {
  officeId: string;
  subscriptionId: string | null;
  plan: OfficePlan;
  isYearly?: boolean;
  unitCount?: number;
}): Promise<string> {
  const ds = await getDataSource();

  const base = plan.planId === "pro"
    ? Number(plan.priceSar) * Math.max(1, Number(unitCount) || 1)
    : Number(plan.priceSar);
  const amount = Math.round((isYearly ? base * 12 * 0.85 : base) * 100) / 100;
  const tax = Math.round(amount * 0.15 * 100) / 100;
  const total = Math.round((amount + tax) * 100) / 100;
  const today = new Date();

  const invoiceRes = await ds.query(
    `INSERT INTO saas_invoices
       (office_id, subscription_id, plan_id, amount_sar, tax_sar, total_sar, status, due_date, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())
     RETURNING id`,
    [officeId, subscriptionId, plan.planId, amount, tax, total, today.toISOString().slice(0, 10)]
  );
  const saasInvoiceId = String(invoiceRes?.[0]?.id);

  // ZATCA foundation reuse: number + XML + QR stored on zatca_invoices.
  try {
    const [off] = await ds.query(
      `SELECT o.name, o.description_ar, o.vat_number, u.email, u.full_name
         FROM offices o
         LEFT JOIN users u ON u.office_id = o.id AND u.user_type = 'agency'
        WHERE o.id = $1 LIMIT 1`,
      [officeId]
    );
    const invoiceNumber = await generateInvoiceNumber(officeId);
    const data: ZATCAInvoiceData = {
      invoice_number: invoiceNumber,
      invoice_timestamp: new Date().toISOString(),
      seller_name: String(off?.description_ar ?? off?.name ?? "—"),
      seller_vat: off?.vat_number ?? undefined,
      buyer_name: String(off?.full_name ?? "—"),
      total_amount: total,
      vat_amount: tax,
      vat_rate: 0.15,
      payment_method: "bank_transfer",
    };
    const xml = generateZATCAXML(data, { includeLines: true });
    const zres = await ds.query(
      `INSERT INTO zatca_invoices
         (invoice_number, office_id, generated_at, total_amount, vat_amount, vat_rate,
          payment_method, seller_name, seller_vat, buyer_name, xml_payload, qr_payload, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'generated')
       RETURNING id`,
      [
        invoiceNumber, officeId, new Date().toISOString(), total, tax, 0.15,
        "bank_transfer", data.seller_name, data.seller_vat ?? null, data.buyer_name,
        xml, generateZATCAQR(data),
      ]
    );
    await ds.query(`UPDATE saas_invoices SET zatca_invoice_id = $1 WHERE id = $2`, [
      String(zres?.[0]?.id),
      saasInvoiceId,
    ]);
  } catch (err) {
    console.error("[saas-invoice] ZATCA payload failed:", err);
  }

  return saasInvoiceId;
}