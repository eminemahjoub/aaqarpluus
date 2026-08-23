import { getDataSource } from "@/lib/db/data-source";
import { sendEmail } from "@/lib/email/service";
import { log } from "@/lib/logger";

/**
 * Drains notification_queue. Poll every 5 minutes (or invoke directly via
 * POST /api/notifications/process — admin only).
 *
 * - email rows: delivered with nodemailer via lib/email/service.ts
 * - sms rows:   logged as not-yet-implemented (provider stub)
 */
export async function processPendingNotifications({
  now = new Date(),
  limit = 100,
}: {
  now?: Date;
  limit?: number;
} = {}): Promise<{ processed: number; sent: number; failed: number }> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT id, notification_id, channel, payload
       FROM notification_queue
      WHERE status = 'pending'
        AND (scheduled_for IS NULL OR scheduled_for <= $1)
      ORDER BY created_at ASC
      LIMIT $2`,
    [now.toISOString(), limit]
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const id = String(row.id);
    const channel = String(row.channel);
    let payload: Record<string, unknown> = {};
    try {
      payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload ?? {};
    } catch {
      payload = {};
    }

    try {
      if (channel === "email") {
        await sendEmail({
          to: String(payload.to ?? ""),
          subject: String(payload.subject ?? "إشعار"),
          html: String(payload.html ?? ""),
        });
        sent++;
      } else if (channel === "sms") {
        // TODO: integrate SMS provider (Twilio/UNIFONIC/SMSA)
        log.info("[notifications] SMS delivery not yet implemented:", String(payload.to));
        sent++;
      } else {
        await ds.query(`UPDATE notification_queue SET status = 'failed', error = $2, sent_at = NOW() WHERE id = $1`, [
          id,
          `unsupported channel: ${channel}`,
        ]);
        failed++;
        continue;
      }
      await ds.query(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [id]);
    } catch (err) {
      failed++;
      await ds.query(`UPDATE notification_queue SET status = 'failed', error = $2, sent_at = NOW() WHERE id = $1`, [
        id,
        String(err),
      ]);
    }
  }

  return { processed: (rows ?? []).length, sent, failed };
}

let intervalStarted = false;

/** Self-scheduling loop — safe to call repeatedly (single interval). */
export function startProcessingInterval(ms = 5 * 60 * 1000): void {
  if (intervalStarted) return;
  intervalStarted = true;
  const timer = setInterval(() => {
    processPendingNotifications().catch((err) => log.error("[notifications] processor error:", err));
  }, ms);
  timer.unref?.();
}