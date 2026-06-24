import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-bytes-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-must-be-at-least-32-bytes";

import { POST } from "../route";

function createReq(body: unknown, token?: string) {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => {
        if (name === "x-forwarded-for") return "127.0.0.1";
        if (name === "authorization") return token ? `Bearer ${token}` : null;
        return null;
      },
    },
    cookies: {
      get: () => undefined,
    },
  } as any;
}

const mockTask = {
  id: "maint-1",
  title: "Leaky faucet",
  description: "Water leaking from kitchen faucet",
  status: "pending",
  priority: "medium",
  type: "maintenance",
  tenant_id: "tenant-1",
  property_id: "prop-1",
  unit_id: "unit-1",
  contact_id: "tenant-1",
  owner_id: "owner-1",
  cost_sar: 0,
};

const savedNotifications: any[] = [];

vi.mock("@/lib/db/data-source", () => ({
  getDataSource: vi.fn(() =>
    Promise.resolve({
      getRepository: (name: string) => {
        if (name === "Contact") {
          return {
            createQueryBuilder: () => ({
              where: function () {
                return this;
              },
              andWhere: function () {
                return this;
              },
              getOne: vi.fn(() =>
                Promise.resolve({
                  id: "tenant-1",
                  name: "Tenant User",
                  phone: "+966501234567",
                  pin_hash: "$2b$10$hashed",
                })
              ),
            }),
          };
        }
        if (name === "Contract") {
          return {
            createQueryBuilder: () => ({
              where: function () {
                return this;
              },
              andWhere: function () {
                return this;
              },
              orderBy: function () {
                return this;
              },
              getOne: vi.fn(() =>
                Promise.resolve({
                  id: "contract-1",
                  owner_id: "owner-1",
                  property_id: "prop-1",
                  unit_id: "unit-1",
                  status: "active",
                })
              ),
            }),
          };
        }
        if (name === "Property") {
          return {
            createQueryBuilder: () => ({
              where: function () {
                return this;
              },
              getOne: vi.fn(() =>
                Promise.resolve({
                  id: "prop-1",
                  managing_office_id: "office-1",
                  created_by_agency_id: "agency-1",
                })
              ),
            }),
          };
        }
        if (name === "Task") {
          return {
            create: vi.fn(() => mockTask),
            save: vi.fn(() => Promise.resolve(mockTask)),
          };
        }
        if (name === "Notification") {
          return {
            create: vi.fn((payload: any) => payload),
            save: vi.fn((payload: any) => {
              savedNotifications.push(payload);
              return Promise.resolve(payload);
            }),
          };
        }
        return {
          findOne: vi.fn(() => Promise.resolve(null)),
          createQueryBuilder: () => ({ getOne: vi.fn(() => Promise.resolve(null)) }),
        };
      },
      query: vi.fn(() => Promise.resolve([{ id: "agency-user-1" }])),
    })
  ),
}));

vi.mock("@/lib/tenant-api-helpers", () => ({
  getTenantFromRequest: vi.fn(() =>
    Promise.resolve({ tenantId: "tenant-1", email: "+966501234567", name: "Tenant User", userType: "tenant" })
  ),
}));

describe("POST /api/tenant/maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedNotifications.length = 0;
  });

  it("creates a maintenance request and notifies agency users", async () => {
    const req = createReq({ title: "Leaky faucet", description: "Kitchen faucet is leaking", priority: "medium" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("maintenance");
    expect(savedNotifications.length).toBeGreaterThan(0);
    expect(savedNotifications[0].type).toBe("maintenance");
  });

  it("rejects a maintenance request without a description", async () => {
    const req = createReq({ title: "Leaky faucet", description: "   " });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
