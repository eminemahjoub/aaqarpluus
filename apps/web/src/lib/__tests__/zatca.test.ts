import { describe, it, expect } from "vitest";
import { generateZATCAQR, generateZATCAXML, hashInvoice, type ZATCAInvoiceData } from "@/lib/zatca";

const invoice: ZATCAInvoiceData = {
  invoice_number: "INV-1",
  invoice_timestamp: "2026-01-15T10:30:00Z",
  seller_name: "مكتب العقار",
  seller_vat: "300000000000003",
  buyer_name: "مستأجر",
  total_amount: 1150,
  vat_amount: 150,
  vat_rate: 0.15,
  payment_method: "تحويل بنكي",
};

describe("generateZATCAQR", () => {
  it("produces base64 TLV with all 5 tags in order", () => {
    const b64 = generateZATCAQR(invoice);
    const buf = Buffer.from(b64, "base64");

    // Decode TLV sequence
    const tags: [number, string][] = [];
    for (let i = 0; i < buf.length; ) {
      const tag = buf[i];
      const len = buf[i + 1];
      tags.push([tag, buf.subarray(i + 2, i + 2 + len).toString("utf-8")]);
      i += 2 + len;
    }
    expect(tags.map(([t]) => t)).toEqual([1, 2, 3, 4, 5]);
    expect(tags[0][1]).toBe("مكتب العقار");
    expect(tags[1][1]).toBe("300000000000003");
    expect(tags[3][1]).toBe("1150.00");
    expect(tags[4][1]).toBe("150.00");
  });
});

describe("generateZATCAXML", () => {
  it("escapes XML-special characters in names", () => {
    const xml = generateZATCAXML({ ...invoice, seller_name: "A&B <Corp>" });
    expect(xml).toContain("A&amp;B &lt;Corp&gt;");
    expect(xml).not.toContain("A&B");
  });

  it("includes totals and invoice type 388", () => {
    const xml = generateZATCAXML(invoice);
    expect(xml).toContain("<cbc:ID>INV-1</cbc:ID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:Percent>15</cbc:Percent>");
    expect(xml).toContain("1150.00");
    expect(xml).toContain("150.00");
  });
});

describe("hashInvoice", () => {
  it("returns base64 SHA-256 of the XML", () => {
    // Known vector: sha256("hello") base64
    expect(hashInvoice("hello")).toBe("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
  });
});
