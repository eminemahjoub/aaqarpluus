import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { dsMock, helpersMock } = vi.hoisted(() => ({
  dsMock: { query: vi.fn() },
  helpersMock: { getUserFromCookies: vi.fn(), getUserFromRequest: vi.fn() },
}));

vi.mock("@/lib/db/data-source", () => ({
  getDataSource: vi.fn(async () => dsMock),
}));

vi.mock("@/lib/api-helpers", () => ({
  getUserFromCookies: helpersMock.getUserFromCookies,
  getUserFromRequest: helpersMock.getUserFromRequest,
  unauthorized: () => new Response("{}", { status: 401 }),
  badRequest: () => new Response("{}", { status: 400 }),
  ok: () => new Response("{}", { status: 200 }),
  serverError: () => new Response("{}", { status: 500 }),
}));

import {
  AuthError,
  assertPropertyAccess,
  assertUnitAccess,
  assertContractAccess,
  assertTaskAccess,
  getPropertyIdsForContext,
  requireCapability,
  requireRole,
  resolveContext,
  withAuth,
} from "./scope";

const OWNER_USER = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "owner@test.local",
  userType: "owner",
  role: "owner" as const,
  officeId: null,
};

const AGENCY_USER = {
  userId: "22222222-2222-2222-2222-222222222222",
  email: "agency@test.local",
  userType: "agency",
  role: "manager" as const,
  officeId: "33333333-3333-3333-3333-333333333333",
};

const ADMIN_USER = {
  userId: "44444444-4444-4444-4444-444444444444",
  email: "admin@test.local",
  userType: "superadmin",
  role: "admin" as const,
  officeId: null,
};

const PROPERTY_ID = "aaaa0000-0000-0000-0000-000000000001";
const UNIT_ID = "aaaa0000-0000-0000-0000-000000000002";
const CONTRACT_ID = "aaaa0000-0000-0000-0000-000000000003";
const TASK_ID = "aaaa0000-0000-0000-0000-000000000004";

afterEach(() => {
  vi.resetAllMocks();
});

describe("resolveContext", () => {
  it("throws 401 when unauthenticated", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue(null);
    await expect(resolveContext()).rejects.toMatchObject({ status: 401 });
  });

  it("throws 401 when the users row is missing", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue({ userId: "x", email: "e", userType: "agency", officeId: "o" });
    dsMock.query.mockResolvedValue([]);
    await expect(resolveContext()).rejects.toMatchObject({ status: 401 });
  });

  it("throws 403 when offices mismatch", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue({ userId: "x", email: "e", userType: "agency", officeId: "office-a" });
    dsMock.query.mockResolvedValue([
      { id: "x", email: "e", user_type: "agency", office_id: "office-b", is_active: true },
    ]);
    await expect(resolveContext("office-a")).rejects.toMatchObject({ status: 403 });
  });

  it("maps user_type to role", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue({ userId: "x", email: "e", userType: "owner", officeId: null });
    dsMock.query.mockResolvedValue([
      { id: "x", email: "e", user_type: "owner", office_id: null, is_active: true },
    ]);
    const ctx = await resolveContext();
    expect(ctx.role).toBe("owner");
    expect(ctx.userId).toBe("x");
  });
});

describe("assertPropertyAccess (IDOR-safe)", () => {
  it("returns 404 for a missing property — not 403", async () => {
    dsMock.query.mockResolvedValue([]); // SELECT property → none
    await expect(assertPropertyAccess(AGENCY_USER, PROPERTY_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for a property in a different office — same error as missing", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]); // property exists
    dsMock.query.mockResolvedValueOnce([]); // no office_property_links row
    await expect(assertPropertyAccess(AGENCY_USER, PROPERTY_ID)).rejects.toMatchObject({ status: 404 });
    const err = await assertPropertyAccess(AGENCY_USER, PROPERTY_ID).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
  });

  it("returns ctx + propertyId on valid office link", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([{ ok: 1 }]); // link exists
    const ctx = await assertPropertyAccess(AGENCY_USER, PROPERTY_ID);
    expect(ctx.propertyId).toBe(PROPERTY_ID);
    expect(ctx.officeId).toBe(AGENCY_USER.officeId);
  });

  it("allows owners only on their own property", async () => {
    // owner role: property exists but not owned → 404
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([]); // owner_id mismatch
    await expect(assertPropertyAccess(OWNER_USER, PROPERTY_ID)).rejects.toMatchObject({ status: 404 });

    // owned → pass
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([{ ok: 1 }]);
    await expect(assertPropertyAccess(OWNER_USER, PROPERTY_ID)).resolves.toMatchObject({
      propertyId: PROPERTY_ID,
    });
  });

  it("lets admins access any existing property", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]);
    await expect(assertPropertyAccess(ADMIN_USER, PROPERTY_ID)).resolves.toMatchObject({
      propertyId: PROPERTY_ID,
    });
  });
});

describe("assertUnitAccess / assertContractAccess / assertTaskAccess", () => {
  it("unit: 404 when unit missing or unitless property", async () => {
    dsMock.query.mockResolvedValue([]);
    await expect(assertUnitAccess(AGENCY_USER, UNIT_ID)).rejects.toMatchObject({ status: 404 });

    dsMock.query.mockResolvedValue([{ id: UNIT_ID, property_id: null }]);
    await expect(assertUnitAccess(AGENCY_USER, UNIT_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("unit: chains unit → property access", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: UNIT_ID, property_id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([{ ok: 1 }]);
    await expect(assertUnitAccess(AGENCY_USER, UNIT_ID)).resolves.toMatchObject({
      unitId: UNIT_ID,
      propertyId: PROPERTY_ID,
    });
  });

  it("contract: owner path uses contract.owner_id, not property access", async () => {
    dsMock.query.mockResolvedValueOnce([
      { id: CONTRACT_ID, property_id: PROPERTY_ID, unit_id: UNIT_ID, owner_id: OWNER_USER.userId },
    ]);
    await expect(assertContractAccess(OWNER_USER, CONTRACT_ID)).resolves.toMatchObject({
      contractId: CONTRACT_ID,
      unitId: UNIT_ID,
    });
  });

  it("contract: not the owner's → falls back to property access and 404s", async () => {
    dsMock.query.mockResolvedValueOnce([
      { id: CONTRACT_ID, property_id: PROPERTY_ID, unit_id: UNIT_ID, owner_id: "someone-else" },
    ]);
    await expect(assertContractAccess(OWNER_USER, CONTRACT_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("task: property-level task (unit_id NULL) validates via property", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: TASK_ID, unit_id: null, property_id: PROPERTY_ID }]);
    dsMock.query.mockResolvedValueOnce([{ id: PROPERTY_ID }]); // property exists
    dsMock.query.mockResolvedValueOnce([{ ok: 1 }]); // office link
    await expect(assertTaskAccess(AGENCY_USER, TASK_ID)).resolves.toMatchObject({
      taskId: TASK_ID,
      unitId: null,
      propertyId: PROPERTY_ID,
    });
  });

  it("task: orphan (no unit, no property) → 404", async () => {
    dsMock.query.mockResolvedValueOnce([{ id: TASK_ID, unit_id: null, property_id: null }]);
    await expect(assertTaskAccess(AGENCY_USER, TASK_ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe("requireRole / requireCapability", () => {
  it("requireRole throws 403 when role not allowed", async () => {
    expect(() => requireRole(OWNER_USER, "admin", "manager")).toThrowError(
      expect.objectContaining({ status: 403 })
    );
    expect(() => requireRole(OWNER_USER, "owner")).not.toThrow();
  });

  it("properties_mutate blocks owners, allows agencies", async () => {
    expect(() => requireCapability(OWNER_USER, "properties_mutate")).toThrowError(
      expect.objectContaining({ status: 403 })
    );
    expect(() => requireCapability(AGENCY_USER, "properties_mutate")).not.toThrow();
  });
});

describe("getPropertyIdsForContext", () => {
  it("admin is unrestricted (null)", async () => {
    await expect(getPropertyIdsForContext(ADMIN_USER)).resolves.toBeNull();
  });

  it("office users resolve via office_property_links", async () => {
    dsMock.query.mockResolvedValue([
      { property_id: "p1" },
      { property_id: "p2" },
    ]);
    const ids = await getPropertyIdsForContext(AGENCY_USER);
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("owners resolve via direct ownership", async () => {
    dsMock.query.mockResolvedValue([{ id: "p1" }]);
    const ids = await getPropertyIdsForContext(OWNER_USER);
    expect(ids).toEqual(["p1"]);
  });
});

describe("withAuth", () => {
  function makeRequest() {
    return {
      url: "http://localhost/api/test",
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as NextRequest;
  }
  const routeCtx = { params: Promise.resolve({ id: "x" }) };

  it("returns 401 JSON when the resolver fails auth", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue(null); // resolveContext → 401
    const handler = withAuth(
      async () => resolveContext(),
      async () => new Response("ok")
    );
    const res = await handler(makeRequest(), routeCtx as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("propagates AppError details", async () => {
    const handler = withAuth(
      async () => {
        const err = new AuthError("ممنوع", 403);
        (err as any).details = [{ path: "status", message: "bad" }];
        throw err;
      },
      async () => new Response("ok")
    );
    const res = await handler(makeRequest(), routeCtx as any);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.details).toEqual([{ path: "status", message: "bad" }]);
  });

  it("calls the handler with the resolved context", async () => {
    helpersMock.getUserFromCookies.mockResolvedValue({ userId: "x", email: "e", userType: "owner", officeId: null });
    dsMock.query.mockResolvedValue([{ id: "x", email: "e", user_type: "owner", office_id: null, is_active: true }]);
    let seenCtx: unknown = null;
    const handler = withAuth(
      async () => resolveContext(),
      async (ctx) => {
        seenCtx = ctx;
        return new Response("ok", { status: 200 });
      }
    );
    const res = await handler(makeRequest(), routeCtx as any);
    expect(res.status).toBe(200);
    expect(seenCtx).toMatchObject({ userId: "x", role: "owner" });
  });

  it("rethrows non-AppError for the route's own handling", async () => {
    const handler = withAuth(
      async () => {
        throw new Error("boom");
      },
      async () => new Response("ok")
    );
    await expect(handler(makeRequest(), routeCtx as any)).rejects.toThrow("boom");
  });
});