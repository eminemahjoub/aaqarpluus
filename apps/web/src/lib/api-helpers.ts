import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyToken, TOKEN_COOKIE, type JwtPayload } from "./auth";
import { jsonResponse } from "./errors";
import { log } from "./logger";

export async function getUserFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  // Identity is always derived from a verified credential — never from
  // request headers. The proxy strips inbound x-user-* headers, but a route
  // must not depend on that for authz (exempted prefixes bypass the gate,
  // and the matcher's static-asset carve-out skips the proxy entirely).
  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  if (cookieToken) return verifyToken(cookieToken);

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }
  return null;
}

export async function getUserFromCookies(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function unauthorized() {
  return jsonResponse({ error: "غير مصرح", code: "UNAUTHORIZED" }, 401);
}

export function badRequest(message: string) {
  return jsonResponse({ error: message, code: "BAD_REQUEST" }, 400);
}

export function ok(data: unknown) {
  return jsonResponse(data, 200);
}

export function created(data: unknown) {
  return jsonResponse(data, 201);
}

export function serverError(error: unknown) {
  log.error(error);
  return jsonResponse({ error: "خطأ في الخادم", code: "INTERNAL" }, 500);
}
