import { createHmac, timingSafeEqual } from "crypto";
import { log } from "@/lib/logger";

/**
 * Tap Payments client — interface complete, transport STUB until
 * TAP_SECRET_KEY credentials are configured (test/demo accounts pending).
 * Webhooks accept Tap's real payload shapes, so un-stubbing the client is
 * config-only.
 */
export type TapChargeStatus =
  | "INITIATED" | "IN_PROGRESS" | "CAPTURED" | "FAILED"
  | "CANCELLED" | "DECLINED" | "VOID" | "TIMEDOUT" | "UNKNOWN";

export interface TapChargeParams {
  amount: number;
  currency: "SAR";
  description: string;
  customer: { id?: string; email: string; phone: string; name: string };
  source: string;
  redirect_url: string;
  metadata: Record<string, string>;
}

export interface TapChargeResult {
  id: string;
  status: TapChargeStatus;
  amount: number;
  currency: string;
  transaction?: { authorization_id?: string; receipt_id?: string };
  reference?: { gateway?: string; payment?: string };
  metadata?: Record<string, string>;
}

const configured = Boolean(process.env.TAP_SECRET_KEY);

// Currencies whose amounts Tap signs to 3 decimal places; everything else is 2.
const TAP_THREE_DECIMAL_CURRENCIES = new Set(["BHD", "KWD", "OMR", "JOD", "IQD", "TND"]);

/**
 * Verifies the `hashstring` header Tap sends on webhook deliveries.
 * Tap signs an ordered x_-labelled concatenation with HMAC-SHA256 hex, keyed
 * by the Secret API Key (the same key as Bearer auth). Field order is fixed —
 * see https://developers.tap.company/docs/webhook
 */
export function verifyTapWebhookSignature(
  hashstring: string | null,
  body: Record<string, any> | null
): boolean {
  const secret = process.env.TAP_SECRET_KEY;
  if (!secret || !hashstring || !body) return false;
  const decimals = TAP_THREE_DECIMAL_CURRENCIES.has(String(body.currency ?? "")) ? 3 : 2;
  const amount = Number(body.amount ?? 0).toFixed(decimals);
  const signed =
    `x_id${body.id ?? ""}` +
    `.x_amount${amount}` +
    `.x_currency${body.currency ?? ""}` +
    `.x_gateway_reference${body.reference?.gateway ?? ""}` +
    `.x_payment_reference${body.reference?.payment ?? ""}` +
    `.x_status${body.status ?? ""}` +
    `.x_created${body.transaction?.created ?? ""}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(hashstring), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createCharge(params: TapChargeParams): Promise<TapChargeResult> {
  if (!configured) {
    log.info("[tap] createCharge stub (no TAP_SECRET_KEY):", params.description);
    return { id: `stub_${Date.now()}`, status: "INITIATED", amount: params.amount, currency: "SAR" };
  }
  const res = await fetch(`${process.env.TAP_BASE_URL ?? "https://api.tap.company/v2"}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return (await res.json()) as TapChargeResult;
}

export async function retrieveCharge(chargeId: string): Promise<TapChargeResult> {
  const res = await fetch(
    `${process.env.TAP_BASE_URL ?? "https://api.tap.company/v2"}/charges/${chargeId}`,
    { headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY}` } }
  );
  return (await res.json()) as TapChargeResult;
}

export async function createCustomer(office: {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): Promise<{ id: string }> {
  if (!configured) return { id: `stub_customer_${office.id}` };
  const res = await fetch(`${process.env.TAP_BASE_URL ?? "https://api.tap.company/v2"}/customers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: office.email,
      phone: { country_code: "966", number: String(office.phone ?? "").replace(/^0/, "") },
      name: office.name,
      metadata: { office_id: office.id },
    }),
  });
  return (await res.json()) as { id: string };
}