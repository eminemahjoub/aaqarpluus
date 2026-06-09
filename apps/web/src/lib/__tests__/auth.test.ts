import { describe, it, expect } from "vitest";
import { signAccessToken, signRefreshToken, verifyToken, verifyRefreshToken } from "@/lib/auth";

describe("auth tokens", () => {
  const payload = {
    userId: "550e8400-e29b-41d4-a716-446655440000",
    email: "test@aaqarplus.sa",
    userType: "agency",
    officeId: "office-123",
  };

  it("should sign and verify an access token", async () => {
    const token = await signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(payload.userId);
    expect(decoded!.email).toBe(payload.email);
    expect(decoded!.userType).toBe(payload.userType);
    expect(decoded!.officeId).toBe(payload.officeId);
  });

  it("should sign and verify a refresh token", async () => {
    const refresh = await signRefreshToken({ userId: payload.userId, tokenVersion: 1 });
    expect(typeof refresh).toBe("string");

    const decoded = await verifyRefreshToken(refresh);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(payload.userId);
    expect(decoded!.tokenVersion).toBe(1);
  });

  it("should return null for an invalid token", async () => {
    const decoded = await verifyToken("not.a.valid.token");
    expect(decoded).toBeNull();
  });

  it("should return null for a tampered token", async () => {
    const token = await signAccessToken(payload);
    const tampered = token.slice(0, -5) + "xxxxx";
    const decoded = await verifyToken(tampered);
    expect(decoded).toBeNull();
  });
});
