export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUserFromRequest } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";
import { resolveLocalUploadPath } from "@/lib/storage";
import { getDataSource } from "@/lib/db/data-source";
import { classifyUploadPath, canAccessOwnerFiles, canAccessMessageFile } from "@/lib/upload-access";

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
 * public/) to authorized staff. Previously these were public static files:
 * anyone holding a URL could read tenant documents.
 *
 * Access rules (see lib/upload-access.ts):
 *  - requires a staff session (tenant PIN users are denied — they reach their
 *    receipts via /api/receipts/*)
 *  - superadmin: everything
 *  - logos/: any staff user (office branding shown across roles)
 *  - messages/: participant in the owning conversation
 *  - <ownerId>/ and properties|units/<ownerId>/: self, or agency linked to
 *    that owner (office_owner_links / created_by_agency_id)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const user = await getUserFromRequest(req);
  if (!user) {
    // A tenant session alone is not sufficient — respond as unauthenticated.
    const tenant = await getTenantFromRequest(req);
    return new Response("Unauthorized", { status: tenant ? 403 : 401 });
  }

  const segments = (await params).path ?? [];
  const abs = segments.length ? resolveLocalUploadPath(segments) : null;
  if (!abs) return new Response("Bad request", { status: 400 });

  const cls = classifyUploadPath(segments);
  const ds = await getDataSource();
  let allowed = false;
  if (String(user.userType) === "superadmin") {
    allowed = true;
  } else if (cls.kind === "logos") {
    allowed = true;
  } else if (cls.kind === "messages") {
    allowed = await canAccessMessageFile(ds, user, segments.join("/"));
  } else if (cls.kind === "owner") {
    allowed = await canAccessOwnerFiles(ds, user, cls.ownerId);
  }
  // 404 rather than 403 — do not disclose which paths exist.
  if (!allowed) return new Response("Not found", { status: 404 });

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
