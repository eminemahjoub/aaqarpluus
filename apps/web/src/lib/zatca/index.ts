import { createHash } from "crypto";
import { getDataSource } from "@/lib/db/data-source";

export interface ZATCAInvoiceData {
  invoice_number: string;
  invoice_timestamp: string; // ISO 8601 with timezone (e.g. new Date().toISOString())
  seller_name: string;
  seller_vat?: string;
  buyer_name: string;
  buyer_vat?: string;
  total_amount: number;
  vat_amount: number;
  vat_rate: number;
  payment_method: string;
  previous_invoice_hash?: string;
}

/**
 * Sequential invoice number per office: INV-YYYYMMDD-XXXX.
 * Atomic upsert on office_invoice_counters (migration 006) — no RPC needed,
 * safe under concurrency (single INSERT .. ON CONFLICT .. RETURNING).
 */
export async function generateInvoiceNumber(officeId: string): Promise<string> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `INSERT INTO office_invoice_counters (office_id, counter)
     VALUES ($1, 1)
     ON CONFLICT (office_id) DO UPDATE SET counter = office_invoice_counters.counter + 1
     RETURNING counter`,
    [officeId]
  );
  const counter = Number(rows?.[0]?.counter) || 1;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${date}-${String(counter).padStart(4, "0")}`;
}

/**
 * ZATCA QR payload — TLV-encoded, Base64:
 *  Tag 1: Seller Name (UTF-8)
 *  Tag 2: VAT Registration Number
 *  Tag 3: Timestamp (ISO 8601)
 *  Tag 4: Invoice Total (with VAT)
 *  Tag 5: VAT Total
 */
export function generateZATCAQR(data: ZATCAInvoiceData): string {
  function tlv(tag: number, value: string): Buffer {
    const valueBytes = Buffer.from(value, "utf-8");
    return Buffer.concat([Buffer.from([tag]), Buffer.from([Math.min(valueBytes.length, 255)]), valueBytes]);
  }

  const tlvBuffer = Buffer.concat([
    tlv(1, data.seller_name),
    tlv(2, data.seller_vat ?? ""),
    tlv(3, data.invoice_timestamp),
    tlv(4, data.total_amount.toFixed(2)),
    tlv(5, data.vat_amount.toFixed(2)),
  ]);

  return tlvBuffer.toString("base64");
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Simplified UBL XML, unsigned.
 * UNSIGNED XML — Phase-2 signing requires ZATCA CSID credentials.
 */
export function generateZATCAXML(data: ZATCAInvoiceData): string {
  const seller = escapeXml(data.seller_name);
  const buyer = escapeXml(data.buyer_name);
  const sellerVat = escapeXml(data.seller_vat ?? "");
  const date = data.invoice_timestamp.slice(0, 10);
  const time = data.invoice_timestamp.slice(11, 19);
  const taxable = (data.total_amount - data.vat_amount).toFixed(2);
  const sellerTaxScheme = data.seller_vat
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${sellerVat}</cbc:CompanyID><cbc:TaxSchemeID>VAT</cbc:TaxSchemeID></cac:PartyTaxScheme>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${escapeXml(data.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${date}</cbc:IssueDate>
  <cbc:IssueTime>${time}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${seller}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${sellerTaxScheme}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${buyer}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${data.vat_amount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${taxable}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${data.vat_amount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${(data.vat_rate * 100).toFixed(0)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="SAR">${data.total_amount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${data.total_amount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

/** SHA-256 of the invoice XML (Base64) — used for invoice chaining. */
export function hashInvoice(xml: string): string {
  return createHash("sha256").update(xml).digest("base64");
}