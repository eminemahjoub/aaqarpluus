import { getDataSource } from "@/lib/db/data-source";
import { log } from "@/lib/logger";

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

async function ensureTable(ds: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      count INT NOT NULL DEFAULT 1,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `);
}

export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    const ds = await getDataSource();
    await ensureTable(ds);

    const result = await ds.query(
      `
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES ($1, 1, NOW() + INTERVAL '1 second' * $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.reset_at < NOW() THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at < NOW() THEN NOW() + INTERVAL '1 second' * $2
          ELSE rate_limits.reset_at
        END
      RETURNING count, reset_at
      `,
      [key, windowSeconds]
    );

    const row = (result as { count?: number }[])?.[0];
    return (row?.count ?? 0) <= maxRequests;
  } catch (err) {
    log.error("[rate-limit] DB fallback to in-memory:", err);
    // Fallback to in-memory if DB is unavailable
    const now = Date.now();
    const e = buckets.get(key);
    if (!e || now > e.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }
    if (e.count >= maxRequests) return false;
    e.count += 1;
    return true;
  }
}

