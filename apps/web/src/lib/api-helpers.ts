import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyToken, TOKEN_COOKIE, type JwtPayload } from "./auth";

export async function getUserFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  // Support both cookie-based auth (browser) and Bearer token (API/curl/mobile)
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
  return new Response(JSON.stringify({ error: "غير مصرح" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function created(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

export function serverError(error: unknown) {
  console.error(error);
  return new Response(JSON.stringify({ error: "خطأ في الخادم" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
