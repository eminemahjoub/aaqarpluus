import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyToken, TOKEN_COOKIE, type JwtPayload } from "./auth";
import { jsonResponse } from "./errors";
import { log } from "./logger";

export async function getUserFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  // 1. Fast path: headers injected by middleware (already verified)
  const userId = req.headers.get("x-user-id");
  const email = req.headers.get("x-user-email");
  const userType = req.headers.get("x-user-type");
  if (userId && email && userType) {
    return {
      userId,
      email,
      userType,
      officeId: req.headers.get("x-office-id"),
    };
  }

  // 2. Fallback: direct cookie-based or Bearer token auth (API/curl/mobile)
  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  console.log("[DEBUG] TOKEN_COOKIE=", TOKEN_COOKIE, "cookieToken=", cookieToken ? "present" : "missing");
  if (cookieToken) return verifyToken(cookieToken);

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  console.log("[DEBUG] authHeader=", authHeader ? "present" : "missing");
  if (authHeader?.startsWith("Bearer ")) {
    const verified = await verifyToken(authHeader.slice(7));
    console.log("[DEBUG] bearer verified=", verified ? "yes" : "no");
    return verified;
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
