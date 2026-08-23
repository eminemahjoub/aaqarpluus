export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import * as bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/**
 * POST /api/auth/reset-password
 * Body: { token, email, newPassword }
 *
 * Validates the reset token (SHA-256 hashed at rest, constant-time compare),
 * updates the password with bcrypt(12), marks the token used and invalidates
 * every existing session by bumping users.token_version (the refresh flow
 * rejects tokens whose tokenVersion does not match).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`reset-pw:${ip}`, 5, 900))) {
      return badRequest("محاولات كثيرة، حاول لاحقاً");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

    const token = String((body as any).token ?? "").trim();
    const email = String((body as any).email ?? "").trim().toLowerCase();
    const newPassword = String((body as any).newPassword ?? "");

    if (!token || !email) return badRequest("الرابط غير صالح أو منتهي");
    if (newPassword.length < 6) return badRequest("كلمة المرور يجب أن تكون 6 أحرف على الأقل");

    const ds = await getDataSource();
    const users = await ds.query(
      `SELECT id, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    const user = users?.[0];
    if (!user) return badRequest("الرابط غير صالح أو منتهي");

    const resetRows = await ds.query(
      `SELECT id, token_hash FROM password_resets
        WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [String(user.id)]
    );
    const reset = resetRows?.[0];
    if (!reset) return badRequest("الرابط غير صالح أو منتهي");

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const storedHash = String(reset.token_hash ?? "");
    const stored = Buffer.from(storedHash, "hex");
    const given = Buffer.from(tokenHash, "hex");
    if (stored.length !== given.length || !timingSafeEqual(stored, given)) {
      return badRequest("الرابط غير صالح أو منتهي");
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const tx = await ds.query(
      `UPDATE users
          SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1, updated_at = NOW()
        WHERE id = $2`,
      [newHash, String(user.id)]
    );
    void tx;

    await ds.query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, [String(reset.id)]);

    return ok({ success: true });
  } catch (err) {
    log.error("[reset-password] error:", err);
    return serverError(err);
  }
}