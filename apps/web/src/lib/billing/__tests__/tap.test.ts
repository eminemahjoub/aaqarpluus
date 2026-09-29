import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";

const SECRET = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

const BODY = {
  id: "chg_TS05A4120230736x9K22710693",
  status: "CAPTURED",
  amount: 1,
  currency: "SAR",
  reference: { gateway: "mada_pg70983e7a", payment: "4327230736106619650" },
  transaction: { created: "1698392202943" },
  metadata: { office_id: "office-1", saas_invoice_id: "inv-1" },
};

beforeAll(() => {
  process.env.TAP_SECRET_KEY = SECRET;
});

async function verifier() {
  return (await import("@/lib/billing/tap")).verifyTapWebhookSignature;
}

function expectedHash(body: Record<string, any>): string {
  const signed =
    `x_id${body.id}` +
    `.x_amount${Number(body.amount).toFixed(2)}` +
    `.x_currency${body.currency}` +
    `.x_gateway_reference${body.reference?.gateway ?? ""}` +
    `.x_payment_reference${body.reference?.payment ?? ""}` +
    `.x_status${body.status}` +
    `.x_created${body.transaction?.created ?? ""}`;
  return createHmac("sha256", SECRET).update(signed).digest("hex");
}

describe("verifyTapWebhookSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const verify = await verifier();
    expect(verify(expectedHash(BODY), BODY)).toBe(true);
  });

  it("matches the documented field order", async () => {
    const verify = await verifier();
    const signed =
      "x_idchg_TS05A4120230736x9K22710693" +
      ".x_amount1.00" +
      ".x_currencySAR" +
      ".x_gateway_referencemada_pg70983e7a" +
      ".x_payment_reference4327230736106619650" +
      ".x_statusCAPTURED" +
      ".x_created1698392202943";
    const hash = createHmac("sha256", SECRET).update(signed).digest("hex");
    expect(verify(hash, BODY)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const verify = await verifier();
    const hash = expectedHash(BODY);
    const tampered = { ...BODY, status: "CAPTURED", amount: 999 };
    expect(verify(hash, tampered)).toBe(false);
  });

  it("rejects a signature for a different secret", async () => {
    const verify = await verifier();
    const hash = expectedHash(BODY);
    process.env.TAP_SECRET_KEY = "sk_test_other";
    expect(verify(hash, BODY)).toBe(false);
    process.env.TAP_SECRET_KEY = SECRET;
  });

  it("rejects a missing or malformed hashstring", async () => {
    const verify = await verifier();
    expect(verify(null, BODY)).toBe(false);
    expect(verify("not-a-hash", BODY)).toBe(false);
    expect(verify("", BODY)).toBe(false);
  });

  it("formats 3-decimal currencies correctly", async () => {
    const verify = await verifier();
    const kwd = { ...BODY, amount: 1.5, currency: "KWD" };
    const signed =
      `x_id${kwd.id}` +
      ".x_amount1.500" +
      `.x_currencyKWD` +
      `.x_gateway_reference${kwd.reference.gateway}` +
      `.x_payment_reference${kwd.reference.payment}` +
      `.x_status${kwd.status}` +
      `.x_created${kwd.transaction.created}`;
    const hash = createHmac("sha256", SECRET).update(signed).digest("hex");
    expect(verify(hash, kwd)).toBe(true);
  });
});
