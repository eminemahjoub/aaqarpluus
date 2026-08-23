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
 * Local disk provider — mirrors the current on-disk layout (public/uploads/).
 * Keep the base name server-generated at call sites; this wrapper never
 * sanitizes names (the documents route does that itself today).
 */
export class LocalProvider implements StorageProvider {
  async upload(buffer: Buffer, key: string, contentType?: string): Promise<string> {
    void contentType;
    const abs = path.join(process.cwd(), "public", ...key.split("/"));
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    return `/uploads/${key.replace(/^uploads\//, "")}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/uploads/${key.replace(/^uploads\//, "")}`;
  }

  async delete(key: string): Promise<void> {
    const abs = path.join(process.cwd(), "public", ...key.split("/"));
    try {
      await unlink(abs);
    } catch (err) {
      log.warn("[storage] delete failed:", String(err));
    }
  }
}

export async function readLocalUpload(key: string): Promise<Buffer> {
  const abs = path.join(process.cwd(), "public", ...key.split("/"));
  return readFile(abs);
}