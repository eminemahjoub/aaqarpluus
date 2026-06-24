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
  id: "task-1",
  title: "Test task",
  description: null,
  status: "pending",
  priority: "medium",
  cost_sar: 0,
  type: "task",
  property_id: null,
  unit_id: null,
  contact_id: null,
  tenant_id: null,
  extra: null,
};

const savedTask = { ...mockTask };

vi.mock("@/lib/db/data-source", () => ({
  getDataSource: vi.fn(() =>
    Promise.resolve({
      getRepository: (name: string) => {
        if (name === "Task") {
          return {
            create: vi.fn(() => mockTask),
            save: vi.fn(() => Promise.resolve(savedTask)),
            createQueryBuilder: () => ({
              leftJoinAndSelect: function () {
                return this;
              },
              where: function () {
                return this;
              },
              orderBy: function () {
                return this;
              },
              getOne: vi.fn(() => Promise.resolve(savedTask)),
            }),
          };
        }
        if (name === "Property") {
          return {
            findOne: vi.fn(() =>
              Promise.resolve({
                id: "prop-1",
                owner_id: "owner-1",
                created_by_agency_id: null,
              })
            ),
          };
        }
        return {
          findOne: vi.fn(() => Promise.resolve(null)),
        };
      },
      query: vi.fn(() => Promise.resolve([])),
    })
  ),
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: vi.fn(() =>
    Promise.resolve({ userId: "owner-1", email: "test@example.com", userType: "owner" })
  ),
}));

vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    getUserFromRequest: vi.fn(() =>
      Promise.resolve({ userId: "owner-1", email: "test@example.com", userType: "owner" })
    ),
  };
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task with default status", async () => {
    const req = createReq({ title: "Test task" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Test task");
    expect(body.status).toBe("pending");
  });

  it("rejects a task without a title", async () => {
    const req = createReq({ title: "  " });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
