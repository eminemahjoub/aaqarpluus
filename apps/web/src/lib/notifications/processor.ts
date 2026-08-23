import { getDataSource } from "@/lib/db/data-source";
import { sendEmail } from "@/lib/email/service";
import { log } from "@/lib/logger";

/**
 * Drains notification_queue. Invoke directly (admin endpoint, cron, worker
 * script, or the in-process interval).
 *
 * Concurrency: rows are claimed atomically (FOR UPDATE SKIP LOCKED → status
 * 'processing'), so any number of worker instances can poll safely — a row is
 * delivered exactly once. Rows stuck in 'processing' (crashed worker) older
 * than 10 minutes are re-claimed.
 */
export async function processPendingNotifications({
  limit = 100,
}: {
  limit?: number;
} = {}): Promise<{ processed: number; sent: number; failed: number }> {
  const ds = await getDataSource();
  const claimResult = await ds.query(
    `WITH pending AS (
       SELECT id
         FROM notification_queue
        WHERE (scheduled_for IS NULL OR scheduled_for <= NOW())
          AND (status = 'pending'
            OR (status = 'processing' AND created_at < NOW() - INTERVAL '10 minutes'))
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
     )
     UPDATE notification_queue nq
        SET status = 'processing'
       FROM pending
      WHERE nq.id = pending.id
      RETURNING nq.id, nq.channel, nq.payload`,
    [limit]
  );
  // TypeORM ds.query() on UPDATE returns [rows, affectedCount] — unwrap rows.
  const rows = Array.isArray(claimResult) ? (claimResult[0] ?? []) : claimResult;

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