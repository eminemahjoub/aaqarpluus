import { NextRequest } from "next/server";
import { verifyTenantToken, TENANT_TOKEN_COOKIE, type TenantJwtPayload } from "./tenant-auth";

export async function getTenantFromRequest(req: NextRequest): Promise<TenantJwtPayload | null> {
  const cookieToken = req.cookies.get(TENANT_TOKEN_COOKIE)?.value;
  if (cookieToken) return verifyTenantToken(cookieToken);

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyTenantToken(authHeader.slice(7));
  }
  return null;
}
