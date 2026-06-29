import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, TOKEN_COOKIE, verifyToken, validateCsrfToken } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // --- API route protection ---
  if (path.startsWith("/api/") && !path.startsWith("/api/auth/") && !path.startsWith("/api/health")) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    if (!token) {
      return new NextResponse(JSON.stringify({ error: "غير مصرح", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const user = await verifyToken(token);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "غير مصرح", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (!safeMethods.includes(request.method)) {
      if (!validateCsrfToken(request)) {
        return new NextResponse(
          JSON.stringify({ error: "طلب غير صالح", code: "INVALID_CSRF" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.userId);
    requestHeaders.set("x-user-email", user.email);
    requestHeaders.set("x-user-type", user.userType);
    if (user.officeId) {
      requestHeaders.set("x-office-id", user.officeId);
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // --- Page route protection ---
  if (path.startsWith("/dashboard") || path.startsWith("/agency") || path.startsWith("/admin")) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!token) {
      if (refresh) return NextResponse.next({ request });
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    const user = await verifyToken(token);
    if (!user) {
      if (refresh) return NextResponse.next({ request });
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const userType = String((user as any).userType ?? "");

    if (path.startsWith("/admin")) {
      if (userType === "superadmin") return NextResponse.next({ request });
      const url = new URL(userType === "agency" ? "/agency" : "/dashboard", request.url);
      return NextResponse.redirect(url);
    }

    if (userType === "agency" && path.startsWith("/dashboard")) {
      const suffix = path.slice("/dashboard".length);
      const known = new Set(["", "/", "/properties", "/properties/units", "/contacts", "/documents", "/reports", "/profile"]);
      const nextPath = known.has(suffix) ? `/agency${suffix}` : "/agency";
      const url = new URL(nextPath, request.url);
      return NextResponse.redirect(url);
    }

    if (userType !== "agency" && path.startsWith("/agency")) {
      const url = new URL("/dashboard", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ],
};
