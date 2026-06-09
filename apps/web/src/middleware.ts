import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, TOKEN_COOKIE, validateCsrfToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public routes
  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/")
  ) {
    return NextResponse.next();
  }

  // Only enforce on API and agency pages
  const isProtected = pathname.startsWith("/api/") || pathname.startsWith("/agency/");
  if (!isProtected) {
    return NextResponse.next();
  }

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
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

  // CSRF check for state-changing methods (skip auth routes that set the cookie)
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (!safeMethods.includes(req.method) && !pathname.startsWith("/api/auth/")) {
    if (!validateCsrfToken(req)) {
      return new NextResponse(
        JSON.stringify({ error: "طلب غير صالح", code: "INVALID_CSRF" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Inject decoded user into headers for downstream API routes
  const requestHeaders = new Headers(req.headers);
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

export const config = {
  matcher: ["/api/:path*", "/agency/:path*", "/dashboard/:path*"],
};
