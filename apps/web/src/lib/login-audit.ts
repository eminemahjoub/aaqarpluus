import { isIP } from "node:net";
import { getDataSource } from "@/lib/db/data-source";
import { log } from "@/lib/logger";

export type FailureReason =
  | "invalid_password"
  | "invalid_pin"
  | "pin_not_set"
  | "account_not_found"
  | "account_inactive"
  | "no_active_contract"
  | "rate_limited";

export function clientIp(req: { headers: Headers }): string | null {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!raw) {
    const real = req.headers.get("x-real-ip")?.trim();
    return real && isIP(real) ? real : null;
  }
  return raw && isIP(raw) ? raw : null;
}

export function clientUserAgent(req: { headers: Headers }): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 500) : null;
}

/**
 * Records a login attempt. NEVER throws — a broken audit write must not
 * block the auth flow (fail-open).
 */
export async function recordLoginAttempt({
  userId,
  email,
  ip,
  userAgent,
  success,
  failureReason,
}: {
  userId?: string | null;
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason?: FailureReason;
}): Promise<void> {
  try {
    const ds = await getDataSource();
    await ds.query(
      `INSERT INTO login_history (user_id, email, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, email.slice(0, 255), ip, userAgent, success, failureReason || null]
    );
  } catch (err) {
    log.error("[login-audit] failed to record login attempt:", err);
  }
}