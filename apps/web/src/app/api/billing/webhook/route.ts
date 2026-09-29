export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";
import { log } from "@/lib/logger";
import { retrieveCharge, verifyTapWebhookSignature, type TapChargeResult } from "@/lib/billing/tap";

/**
 * POST /api/billing/webhook — Tap charge.status callbacks.
 *
 * Trust model: the posted body is NEVER trusted. Two checks before any write:
 *  1. `hashstring` header must match Tap's HMAC-SHA256 over the ordered
 *     x_-labelled field concatenation (signed with TAP_SECRET_KEY).
 *  2. The charge is re-fetched from Tap by id — the fetched status/metadata
 *     drives the update, so a replayed or tampered payload can't lie.
 * Fails closed: without TAP_SECRET_KEY the endpoint returns 503.
 * Payload carries metadata.office_id + metadata.saas_invoice_id.
 */
export async function POST(req: Request) {
  if (!process.env.TAP_SECRET_KEY) {
    log.error("[billing webhook] TAP_SECRET_KEY not configured — refusing webhook");
    return jsonResponse({ ok: false }, 503);
  }

  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!body) return jsonResponse({ ok: false }, 400);

  if (!verifyTapWebhookSignature(req.headers.get("hashstring"), body)) {
    log.warn("[billing webhook] rejected: hashstring mismatch");
    return jsonResponse({ ok: false }, 401);
  }

  const chargeId = String(body.id ?? "");
  let charge: TapChargeResult;
  try {
    charge = await retrieveCharge(chargeId);
  } catch (err) {
    log.error("[billing webhook] charge fetch failed:", err);
    return jsonResponse({ ok: false }, 502);
  }
  if (!charge || String(charge.id) !== chargeId || !charge.status) {
    log.warn("[billing webhook] rejected: charge lookup failed for", chargeId);
    return jsonResponse({ ok: false }, 401);
  }

  // Authoritative values come from the fetched charge; posted metadata is only
  // a fallback for older charges created before metadata was set.
  const status = String(charge.status);
  const officeId = charge.metadata?.office_id
    ? String(charge.metadata.office_id)
    : body.metadata?.office_id
      ? String(body.metadata.office_id)
      : null;
  const invoiceId = charge.metadata?.saas_invoice_id
    ? String(charge.metadata.saas_invoice_id)
    : body.metadata?.saas_invoice_id
      ? String(body.metadata.saas_invoice_id)
      : null;

  const ds = await getDataSource();

  if (status === "CAPTURED") {
    const now = new Date();
    const periodEndsAt = new Date(now.getTime() + 30 * 864e5);
    await ds.query(
      `UPDATE subscriptions
          SET status = 'active', retry_count = 0, current_period_starts_at = NOW(),
              current_period_ends_at = $1, payment_method = 'tap', updated_at = NOW()
        WHERE office_id = $2`,
      [periodEndsAt.toISOString(), officeId]
    );
    if (invoiceId) {
      await ds.query(
        `UPDATE saas_invoices SET status = 'paid', paid_at = NOW(), gateway_payment_id = $1 WHERE id = $2`,
        [chargeId, invoiceId]
      );
    }
    return jsonResponse({ ok: true }, 200);
  }

  if (status === "FAILED" || status === "DECLINED" || status === "TIMEDOUT") {
    if (officeId) {
      await ds.query(
        `UPDATE subscriptions SET retry_count = retry_count + 1, updated_at = NOW() WHERE office_id = $1`,
        [officeId]
      );
      const next = await ds.query(
        `SELECT retry_count FROM subscriptions WHERE office_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [officeId]
      );
      if (Number(next?.[0]?.retry_count) >= 3) {
        await ds.query(
          `UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE office_id = $1`,
          [officeId]
        );
      }
    }
    if (invoiceId) {
      await ds.query(`UPDATE saas_invoices SET status = 'draft' WHERE id = $1`, [invoiceId]);
    }
    return jsonResponse({ ok: true }, 200);
  }

  if (status === "CANCELLED") {
    if (officeId) {
      await ds.query(
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'gateway_cancelled', updated_at = NOW() WHERE office_id = $1`,
        [officeId]
      );
    }
    return jsonResponse({ ok: true }, 200);
  }

  // INITIATED / IN_PROGRESS / VOID / UNKNOWN — ack silently
  return jsonResponse({ ok: true }, 200);
}
