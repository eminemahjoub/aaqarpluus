import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, TOKEN_COOKIE, verifyToken } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protect private areas + route agencies away from /dashboard.
  if (path.startsWith("/dashboard") || path.startsWith("/agency") || path.startsWith("/admin")) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!token) {
      // If access token is missing but refresh exists, allow the app to load;
      // client-side authFetch will refresh on first 401.
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

    // Admin area: only superadmin.
    if (path.startsWith("/admin")) {
      if (userType === "superadmin") return NextResponse.next({ request });
      // logged-in but not superadmin → redirect to their home area
      const url = new URL(userType === "agency" ? "/agency" : "/dashboard", request.url);
      return NextResponse.redirect(url);
    }

    // Agency users should never use /dashboard (redirect to /agency equivalents).
    if (userType === "agency" && path.startsWith("/dashboard")) {
      const suffix = path.slice("/dashboard".length);
      const known = new Set(["", "/", "/properties", "/contacts", "/documents", "/reports", "/profile"]);
      const nextPath = known.has(suffix) ? `/agency${suffix}` : "/agency";
      const url = new URL(nextPath, request.url);
      return NextResponse.redirect(url);
    }

    // Non-agency users should not access /agency.
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
