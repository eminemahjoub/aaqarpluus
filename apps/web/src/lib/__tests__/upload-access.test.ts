import { describe, it, expect, vi } from "vitest";
import { classifyUploadPath, canAccessOwnerFiles, canAccessMessageFile } from "@/lib/upload-access";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("classifyUploadPath", () => {
  it("classifies owner-namespaced paths", () => {
    expect(classifyUploadPath([OWNER, "doc.pdf"])).toEqual({ kind: "owner", ownerId: OWNER });
    expect(classifyUploadPath(["properties", OWNER, "img.jpg"])).toEqual({ kind: "owner", ownerId: OWNER });
    expect(classifyUploadPath(["units", OWNER, "img.jpg"])).toEqual({ kind: "owner", ownerId: OWNER });
  });

  it("classifies fixed dirs", () => {
    expect(classifyUploadPath(["messages", "a.png"])).toEqual({ kind: "messages" });
    expect(classifyUploadPath(["logos", "logo.png"])).toEqual({ kind: "logos" });
  });

  it("rejects malformed or unscoped paths", () => {
    expect(classifyUploadPath([])).toEqual({ kind: "unknown" });
    expect(classifyUploadPath(["not-a-uuid", "f.pdf"])).toEqual({ kind: "unknown" });
    expect(classifyUploadPath(["properties", "not-a-uuid", "f.jpg"])).toEqual({ kind: "unknown" });
    expect(classifyUploadPath(["properties"])).toEqual({ kind: "unknown" });
  });
});

describe("canAccessOwnerFiles", () => {
  const ds = (rows: any[][]) => ({ query: vi.fn(async () => rows.shift() ?? []) } as any);

  it("allows the owner themselves", async () => {
    const ok = await canAccessOwnerFiles(ds([]), { userId: OWNER, userType: "owner" }, OWNER);
    expect(ok).toBe(true);
  });

  it("allows superadmin", async () => {
    const ok = await canAccessOwnerFiles(ds([]), { userId: OTHER, userType: "superadmin" }, OWNER);
    expect(ok).toBe(true);
  });

  it("allows an office-linked agency", async () => {
    const ok = await canAccessOwnerFiles(ds([[{ ok: 1 }]]), { userId: OTHER, userType: "agency", officeId: "off-1" }, OWNER);
    expect(ok).toBe(true);
  });

  it("allows an agency that created the owner", async () => {
    // no officeId → only the created_by_agency query runs
    const ok = await canAccessOwnerFiles(ds([[{ ok: 1 }]]), { userId: OTHER, userType: "agency" }, OWNER);
    expect(ok).toBe(true);
  });

  it("denies unrelated staff and owners", async () => {
    expect(await canAccessOwnerFiles(ds([[]]), { userId: OTHER, userType: "agency" }, OWNER)).toBe(false);
    expect(await canAccessOwnerFiles(ds([]), { userId: OTHER, userType: "viewer" }, OWNER)).toBe(false);
  });
});

describe("canAccessMessageFile", () => {
  it("allows a conversation participant", async () => {
    const ds = {
      query: vi.fn()
        .mockResolvedValueOnce([{ conversation_id: "conv-1" }])
        .mockResolvedValueOnce([{ ok: 1 }]),
    } as any;
    expect(await canAccessMessageFile(ds, { userId: "u-1" }, "messages/f.png")).toBe(true);
  });

  it("denies when the file maps to no message or the user is not a participant", async () => {
    const noMsg = { query: vi.fn().mockResolvedValue([]) } as any;
    expect(await canAccessMessageFile(noMsg, { userId: "u-1" }, "messages/f.png")).toBe(false);

    const notParticipant = {
      query: vi.fn()
        .mockResolvedValueOnce([{ conversation_id: "conv-1" }])
        .mockResolvedValueOnce([]),
    } as any;
    expect(await canAccessMessageFile(notParticipant, { userId: "u-1" }, "messages/f.png")).toBe(false);
  });
});
