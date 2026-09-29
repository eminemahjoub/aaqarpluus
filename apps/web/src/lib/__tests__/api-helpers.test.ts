import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken, TOKEN_COOKIE } from "@/lib/auth";
import { getUserFromRequest } from "@/lib/api-helpers";

// Regression: getUserFromRequest previously trusted x-user-* headers, which are
// client-controlled on proxy-exempted paths (/api/auth/*, /api/receipts/*,
// /api/tenant/*) and on matcher-skipped requests. Identity must come only from
// a verified cookie or Bearer token.

const VICTIM = {
  userId: "550e8400-e29b-41d4-a716-446655440000",
  email: "victim@aaqarplus.sa",
  userType: "superadmin",
};

function req(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/me", { headers });
}

describe("getUserFromRequest", () => {
  it("ignores forged x-user-* headers with no credentials", async () => {
    const r = req({
      "x-user-id": VICTIM.userId,
      "x-user-email": VICTIM.email,
      "x-user-type": VICTIM.userType,
    });
    expect(await getUserFromRequest(r)).toBeNull();
  });

  it("prefers the verified cookie over forged headers", async () => {
    const attacker = {
      userId: "660e8400-e29b-41d4-a716-446655440001",
      email: "attacker@aaqarplus.sa",
      userType: "owner",
      officeId: null,
    };
    const token = await signAccessToken(attacker);
    const r = req({
      cookie: `${TOKEN_COOKIE}=${token}`,
      "x-user-id": VICTIM.userId,
      "x-user-email": VICTIM.email,
      "x-user-type": "superadmin",
    });
    const user = await getUserFromRequest(r);
    expect(user?.userId).toBe(attacker.userId);
    expect(user?.userType).toBe("owner");
  });

  it("verifies a Bearer token", async () => {
    const token = await signAccessToken({ ...VICTIM, officeId: null });
    const r = req({ authorization: `Bearer ${token}` });
    const user = await getUserFromRequest(r);
    expect(user?.userId).toBe(VICTIM.userId);
  });

  it("returns null for a forged Bearer token", async () => {
    const r = req({ authorization: "Bearer not.a.token" });
    expect(await getUserFromRequest(r)).toBeNull();
  });
});
