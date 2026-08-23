export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  withAuth,
  resolveContext,
  requireRole,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * GET /api/admin/login-history?userId=... — any user's login history.
 * Admin-only (403 otherwise). Rate-limited to 30/15min.
 */
export const GET = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireRole(ctx, "admin");
    return ctx;
  },
  async (ctx, req) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`admin-login-history:${ip}`, 30, 900))) {
      return ok({ events: [] });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return ok({ events: [] });

    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT id, email, ip_address, user_agent, success, failure_reason, created_at
         FROM login_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId]
    );

    void ctx;
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