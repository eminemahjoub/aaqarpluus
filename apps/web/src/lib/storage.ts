import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { log } from "@/lib/logger";

export interface StorageProvider {
  /** Uploads bytes under a key; returns the public URL (or presigned-able reference). */
  upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
  getSignedUrl(key: string, expirySeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_BUCKET);
}

/** Root of the local uploads dir — outside public/ so files are only served via the auth-gated /uploads/ route handler. */
export function localUploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
}

/**
 * Resolves /uploads/<segments> to an absolute path inside localUploadsRoot().
 * Returns null on traversal outside the root.
 */
export function resolveLocalUploadPath(segments: string[]): string | null {
  const root = path.resolve(localUploadsRoot());
  const abs = path.resolve(root, ...segments);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

/**
 * Resolves the active provider: S3 when configured, local disk otherwise.
 * Callers that need behavior parity must check isStorageConfigured() for
 * presigned URLs (local = plain public paths).
 */
export function getStorage(): StorageProvider {
  if (isStorageConfigured()) {
    // lazy require keeps the SDK out of the local bundle path when unused
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Provider } = require("@/lib/storage/s3") as typeof import("@/lib/storage/s3");
    return new S3Provider();
  }
  return new LocalProvider();
}

/**
 * Local disk provider — writes under localUploadsRoot() (data/uploads by
 * default) and returns /uploads/ URLs served by the auth-gated route handler.
 * Keep the base name server-generated at call sites; this wrapper never
 * sanitizes names (the documents route does that itself today).
 */
export class LocalProvider implements StorageProvider {
  async upload(buffer: Buffer, key: string, contentType?: string): Promise<string> {
    void contentType;
    const rel = key.replace(/^uploads\//, "");
    const abs = resolveLocalUploadPath(rel.split("/"));
    if (!abs) throw new Error(`Invalid upload key: ${key}`);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    return `/uploads/${rel}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/uploads/${key.replace(/^uploads\//, "")}`;
  }

  async delete(key: string): Promise<void> {
    const abs = resolveLocalUploadPath(key.replace(/^uploads\//, "").split("/"));
    if (!abs) return;
    try {
      await unlink(abs);
    } catch (err) {
      log.warn("[storage] delete failed:", String(err));
    }
  }
}

export async function readLocalUpload(key: string): Promise<Buffer> {
  const abs = resolveLocalUploadPath(key.replace(/^uploads\//, "").split("/"));
  if (!abs) throw new Error(`Invalid upload key: ${key}`);
  return readFile(abs);
}