/**
 * Standalone notification queue worker.
 *
 *   Run:      npm run worker            (tsx scripts/queue-worker.ts)
 *   PM2:      pm2 start --name queue-worker -- npx tsx scripts/queue-worker.ts
 *   Compose:  worker service with `command: npx tsx scripts/queue-worker.ts`
 *             and a restart policy; rows are claimed atomically
 *             (FOR UPDATE SKIP LOCKED), so extra instances are safe.
 *   Fallback: `* * * * * curl -sf http://localhost:3000/api/notifications/process`
 *             (admin-only; drains the queue once per minute).
 *
 * Heartbeat: writes worker_heartbeats on every tick. Health check — a healthy
 * system returns ZERO rows from:
 *   SELECT * FROM worker_heartbeats WHERE last_beat < NOW() - INTERVAL '2 minutes';
 */
import { processPendingNotifications } from "@/lib/notifications/processor";
import { getDataSource } from "@/lib/db/data-source";

const TICK_MS = 30_000;
const WORKER_NAME = "queue-worker";

async function heartbeat(): Promise<void> {
  const ds = await getDataSource();
  await ds.query(
    `INSERT INTO worker_heartbeats (worker_name, last_beat)
     VALUES ($1, NOW())
     ON CONFLICT (worker_name) DO UPDATE SET last_beat = NOW(), updated_at = NOW()`,
    [WORKER_NAME]
  );
}

async function tick(): Promise<void> {
  const result = await processPendingNotifications();
  await heartbeat();
  console.log(
    `[queue-worker] tick ok — processed=${result.processed} sent=${result.sent} failed=${result.failed}`
  );
}

async function main(): Promise<void> {
  console.log(`[queue-worker] started (tick every ${TICK_MS / 1000}s)`);
  await getDataSource(); // ensure the pool is connected before looping

  // First tick immediately, then on the interval.
  await tick().catch((err) => console.error("[queue-worker] tick failed:", err));

  const timer = setInterval(() => {
    tick().catch((err) => console.error("[queue-worker] tick failed:", err));
  }, TICK_MS);

  const shutdown = () => {
    console.log("[queue-worker] shutting down");
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[queue-worker] fatal error:", err);
  process.exit(1);
});