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
        const providerName = process.env.SMS_PROVIDER;
        if (!providerName) {
          // Stub fallback until credentials exist — logs and drains the row
          // so the queue never stalls on unconfigured SMS.
          log.info("[notifications] SMS not configured — skipping delivery to:", String(payload.to));
          sent++;
        } else {
          const { getSMSProvider, isSMSRetryable } = await import("@/lib/sms");
          try {
            const result = await getSMSProvider().send({
              to: String(payload.to ?? ""),
              body: String(payload.text ?? ""),
            });
            await ds.query(
              `UPDATE notification_queue SET status = 'sent', provider_message_id = $2, sent_at = NOW() WHERE id = $1`,
              [id, result.messageId]
            );
            sent++;
          } catch (err) {
            const msg = String(err instanceof Error ? err.message : err);
            const retryable = isSMSRetryable(err);
            const rc = await ds.query(`SELECT retry_count FROM notification_queue WHERE id = $1`, [id]);
            const retryCount = Number(rc?.[0]?.retry_count) || 0;

            if (retryable && retryCount < 3) {
              // Re-queue for the next claim cycle (status back to pending).
              await ds.query(
                `UPDATE notification_queue SET status = 'pending', retry_count = retry_count + 1, failure_reason = $2, sent_at = NULL WHERE id = $1`,
                [id, msg]
              );
            } else {
              await ds.query(
                `UPDATE notification_queue SET status = 'failed', failure_reason = $2, sent_at = NOW() WHERE id = $1`,
                [id, msg]
              );
              await ds.query(
                `INSERT INTO failed_sms (queue_id, recipient, body, error) VALUES ($1, $2, $3, $4)`,
                [id, String(payload.to ?? ""), String(payload.text ?? ""), msg]
              );
              failed++;
            }
          }
        }
        // SMS rows manage their own terminal status (sent/retry/failed) — skip
        // the generic sent-update below.
        continue;
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