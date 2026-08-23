export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email/service";
import { log } from "@/lib/logger";

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * - Rate limited: 5 / 15 min / IP.
 * - Always returns { success: true } whether or not the email exists
 *   (anti user-enumeration).
 * - In development (or when SMTP is unconfigured) the raw token is echoed
 *   back as devToken so the reset flow can be exercised end-to-end.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`forgot-pw:${ip}`, 5, 900))) {
      return badRequest("محاولات كثيرة، حاول لاحقاً");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || typeof (body as any).email !== "string") {
      return badRequest("البريد الإلكتروني مطلوب");
    }
    const email = String((body as any).email).trim().toLowerCase();
    if (!email) return badRequest("البريد الإلكتروني مطلوب");

    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    const user = rows?.[0];

    const isDev = process.env.NODE_ENV === "development";
    let devToken: string | undefined;

    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await ds.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [String(user.id), tokenHash, expiresAt]
      );

      const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
      const resetUrl = `${appUrl || "http://localhost:3000"}/forgot-password?token=${rawToken}&email=${encodeURIComponent(String(user.email))}`;

      const configured = isEmailConfigured();
      if (configured && !isDev) {
        await sendPasswordResetEmail({ to: email, resetUrl, lang: "ar" });
      } else {
        log.info("[forgot-password] reset link (email not sent):", resetUrl);
        if (isDev) devToken = rawToken;
      }
    }

    if (isDev && devToken) {
      return ok({ success: true, devToken, devLink: `/forgot-password?token=${devToken}&email=${encodeURIComponent(email)}` });
    }
    return ok({ success: true });
  } catch (err) {
    log.error("[forgot-password] error:", err);
    return serverError(err);
  }
}