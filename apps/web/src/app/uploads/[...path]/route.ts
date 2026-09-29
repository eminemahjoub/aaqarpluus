export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUserFromRequest } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";
import { resolveLocalUploadPath } from "@/lib/storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  svg: "image/svg+xml",
};

// Only types that cannot execute script are displayed inline; everything else
// (html, svg-adjacent, unknown) is forced to a download to prevent stored XSS.
const INLINE_SAFE = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf", "mp4", "webm"]);

/**
 * GET /uploads/* — serves files from the uploads dir (data/uploads, outside
 * public/) to any authenticated staff or tenant session. Previously these
 * were public static files: anyone holding a URL could read tenant documents.
 *
 * NOTE: this authenticates but does not scope per-owner — any logged-in user
 * can fetch any upload. Per-object authorization is a follow-up.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const [user, tenant] = await Promise.all([getUserFromRequest(req), getTenantFromRequest(req)]);
  if (!user && !tenant) {
    return new Response("Unauthorized", { status: 401 });
  }

  const segments = (await params).path ?? [];
  const abs = segments.length ? resolveLocalUploadPath(segments) : null;
  if (!abs) return new Response("Bad request", { status: 400 });

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(abs).slice(1).toLowerCase();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": INLINE_SAFE.has(ext) ? "inline" : "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
