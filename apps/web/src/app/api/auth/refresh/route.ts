import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, unauthorized, serverError, badRequest } from "@/lib/api-helpers";
import { REFRESH_COOKIE, TOKEN_COOKIE, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

function cookie(name: string, token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`refresh:${ip}`, 30, 60)) return badRequest("طلبات كثيرة، حاول لاحقاً");

    const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
    if (!refresh) return unauthorized();

    const payload = await verifyRefreshToken(refresh);
    if (!payload?.userId) return unauthorized();

    const ds = await getDataSource();
    const user = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.id = :id", { id: String(payload.userId) })
      .getOne();
    if (!user) return unauthorized();

    const currentVersion = Number((user as any).token_version) || 0;
    if (Number(payload.tokenVersion) !== currentVersion) return unauthorized();

    // Rotate refresh token: bump version so the old refresh becomes invalid.
    const nextVersion = currentVersion + 1;
    await ds.query(`UPDATE users SET token_version = $1 WHERE id = $2`, [nextVersion, String(payload.userId)]);

    const accessToken = await signAccessToken({
      userId: (user as any).id,
      email: (user as any).email,
      userType: (user as any).user_type,
      officeId: (user as any).office_id ?? null,
    });
    const nextRefresh = await signRefreshToken({ userId: String((user as any).id), tokenVersion: nextVersion });

    const res = ok({ accessToken });
    res.headers.append("Set-Cookie", cookie(TOKEN_COOKIE, accessToken, 15 * 60));
    res.headers.append("Set-Cookie", cookie(REFRESH_COOKIE, nextRefresh, 7 * 24 * 3600));
    return res;
  } catch (err) {
    return serverError(err);
  }
}

