export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";

/**
 * POST /api/billing/webhook — Tap charge.status callbacks.
 * TODO(prod): verify the Tap signature header when credentials land.
 * Payload carries metadata.office_id + metadata.saas_invoice_id.
 */
export async function POST(req: Request) {
  const ds = await getDataSource();
  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!body) return jsonResponse({ ok: false }, 400);

  const status = String(body.status ?? "");
  const chargeId = String(body.id ?? "");
  const officeId = body.metadata?.office_id ? String(body.metadata.office_id) : null;
  const invoiceId = body.metadata?.saas_invoice_id ? String(body.metadata.saas_invoice_id) : null;

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