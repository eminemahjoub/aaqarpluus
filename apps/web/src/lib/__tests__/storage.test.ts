import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

let uploadsDir: string;

beforeAll(async () => {
  uploadsDir = await mkdtemp(path.join(tmpdir(), "uploads-test-"));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterAll(async () => {
  delete process.env.UPLOADS_DIR;
  await rm(uploadsDir, { recursive: true, force: true });
});

describe("resolveLocalUploadPath", () => {
  it("resolves normal segments under the uploads root", async () => {
    const { resolveLocalUploadPath, localUploadsRoot } = await import("@/lib/storage");
    const abs = resolveLocalUploadPath(["owner-1", "doc.pdf"]);
    expect(abs).toBe(path.join(localUploadsRoot(), "owner-1", "doc.pdf"));
  });

  it("rejects '..' traversal", async () => {
    const { resolveLocalUploadPath } = await import("@/lib/storage");
    expect(resolveLocalUploadPath(["..", "secrets.txt"])).toBeNull();
    expect(resolveLocalUploadPath(["a", "..", "..", "etc", "passwd"])).toBeNull();
  });

  it("rejects absolute-path escapes", async () => {
    const { resolveLocalUploadPath } = await import("@/lib/storage");
    expect(resolveLocalUploadPath(["/etc", "passwd"])).toBeNull();
    expect(resolveLocalUploadPath([".."])).toBeNull();
  });
});

describe("LocalProvider", () => {
  it("writes files under the uploads root and returns /uploads/ URLs", async () => {
    const { LocalProvider, readLocalUpload } = await import("@/lib/storage");
    const provider = new LocalProvider();
    const url = await provider.upload(Buffer.from("hello"), "uploads/t1/a.txt", "text/plain");
    expect(url).toBe("/uploads/t1/a.txt");
    const back = await readLocalUpload("uploads/t1/a.txt");
    expect(back.toString()).toBe("hello");
  });
});
