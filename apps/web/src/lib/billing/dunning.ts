import { getDataSource } from "@/lib/db/data-source";
import { log } from "@/lib/logger";

/**
 * Daily billing jobs (run 09:00 KSA via cron or the queue worker):
 *  - expired trials → downgrade to Free
 *  - renewal reminder (in-app) 3 days before period end
 *  - period ended + active → attempt auto-charge (gateway stub for now)
 *  - past_due beyond 7-day grace → expired + downgrade
 */
export async function runDailyBillingJobs(): Promise<{ downgraded: number; reminded: number; charged: number; expired: number }> {
  const ds = await getDataSource();
  let downgraded = 0;
  let reminded = 0;
  let charged = 0;
  let expired = 0;

  // 1. Trials expired → downgrade to Free
  const trials = await ds.query(
    `SELECT id, office_id, user_id FROM subscriptions
      WHERE status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < NOW()`
  );
  for (const t of trials ?? []) {
    await ds.query(
      `UPDATE subscriptions SET status = 'expired', plan = 'free', updated_at = NOW() WHERE id = $1`,
      [String(t.id)]
    );
    downgraded++;
  }

  // 2. Renewal reminders 3 days before period end
  const upcoming = await ds.query(
    `SELECT office_id, user_id FROM subscriptions
      WHERE status IN ('trialing','active')
        AND current_period_ends_at IS NOT NULL
        AND current_period_ends_at < NOW() + INTERVAL '3 days'
        AND current_period_ends_at > NOW()`
  );
  for (const r of upcoming ?? []) {
    if (r.user_id) {
      await ds.query(
        `INSERT INTO notifications (user_id, type, title, body, is_read, created_at)
         VALUES ($1, 'billing', 'تجديد الاشتراك', 'ينتهي اشتراكك قريباً — يرجى تجديده لتجنب التوقف.', false, NOW())`,
        [String(r.user_id)]
      );
      reminded++;
    }
  }

  // 3. Period ended + active → auto-charge default method (stub gateway → mark past_due)
  const due = await ds.query(
    `SELECT id FROM subscriptions
      WHERE status = 'active'
        AND current_period_ends_at IS NOT NULL AND current_period_ends_at < NOW()`
  );
  for (const d of due ?? []) {
    // TODO: charge default payment_method via Tap when configured; on success → active + new period
    log.info("[billing-daily] auto-charge attempt (stub) for sub:", String(d.id));
    await ds.query(
      `UPDATE subscriptions SET status = 'past_due', retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1`,
      [String(d.id)]
    );
    charged++;
  }

  // 4. past_due grace (7 days) expired → lock (expired + downgrade)
  const pastDue = await ds.query(
    `SELECT id FROM subscriptions
      WHERE status = 'past_due' AND current_period_ends_at < NOW() - INTERVAL '7 days'`
  );
  for (const p of pastDue ?? []) {
    await ds.query(
      `UPDATE subscriptions SET status = 'expired', plan = 'free', cancel_reason = 'grace_expired', updated_at = NOW() WHERE id = $1`,
      [String(p.id)]
    );
    expired++;
  }

  return { downgraded, reminded, charged, expired };
}