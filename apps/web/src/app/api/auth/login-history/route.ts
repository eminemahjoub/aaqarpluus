export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  withAuth,
  resolveContext,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * GET /api/auth/login-history — the caller's own last 50 login events.
 * Rate-limited to 20/15min to prevent abuse.
 */
export const GET = withAuth<UserContext>(
  async (_req, _ctx) => {
    const ctx = await resolveContext();
    void _ctx;
    return ctx;
  },
  async (ctx, req) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`login-history:${ip}`, 20, 900))) {
      return ok({ events: [] });
    }

    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT id, email, ip_address, user_agent, success, failure_reason, created_at
         FROM login_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [ctx.userId]
    );

    return ok({
      events: (rows ?? []).map((r: any) => ({
        id: String(r.id),
        email: r.email ?? null,
        ip_address: r.ip_address ?? null,
        user_agent: r.user_agent ?? null,
        success: Boolean(r.success),
        failure_reason: r.failure_reason ?? null,
        created_at: r.created_at,
      })),
    });
  }
);