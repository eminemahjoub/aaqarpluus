export const dynamic = "force-dynamic";
import { TOKEN_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { ok, getUserFromRequest } from "@/lib/api-helpers";
import { getDataSource } from "@/lib/db/data-source";

export async function POST(req: Request) {
  const response = ok({ success: true });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Best-effort revoke refresh tokens by bumping token_version.
  try {
    const user = await getUserFromRequest(req as any);
    if (user?.userId) {
      const ds = await getDataSource();
      await ds.query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [String(user.userId)]);
    }
  } catch {
    // ignore
  }

  response.headers.append("Set-Cookie", `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
  response.headers.append("Set-Cookie", `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
  return response;
}
