import { describe, it, expect, vi, beforeAll } from "vitest";

process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-bytes-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-must-be-at-least-32-bytes";

import { POST } from "../route";

function createReq(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : null),
    },
    cookies: {
      get: () => undefined,
    },
  } as any;
}

vi.mock("@/lib/db/data-source", () => ({
  getDataSource: vi.fn(() =>
    Promise.resolve({
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: function () { return this; },
          andWhere: function () { return this; },
          orderBy: function () { return this; },
          getOne: vi.fn(() => Promise.resolve(null)),
        }),
      }),
      query: vi.fn(() => Promise.resolve([])),
    })
  ),
}));

describe("POST /api/auth/login (integration)", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for missing user", async () => {
    const req = createReq({ identifier: "missing@example.com", password: "password123" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 400 for invalid credentials format", async () => {
    const req = createReq({ identifier: "", password: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
