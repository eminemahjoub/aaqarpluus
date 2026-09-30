import type { DataSource } from "typeorm";

/**
 * Per-object authorization for /uploads/* paths.
 *
 * URL conventions written by the upload routes:
 *   /uploads/<ownerId>/<file>                — documents, generated receipts
 *   /uploads/properties|units/<ownerId>/<f>  — property/unit images
 *   /uploads/messages/<file>                 — conversation attachments
 *   /uploads/logos/<file>                    — office logos
 */
export type UploadPathClass =
  | { kind: "owner"; ownerId: string }                          // <ownerId>/... or properties|units/<ownerId>/...
  | { kind: "messages" }
  | { kind: "logos" }
  | { kind: "unknown" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function classifyUploadPath(segments: string[]): UploadPathClass {
  const [a, b] = segments;
  if (!a) return { kind: "unknown" };
  if (a === "messages") return { kind: "messages" };
  if (a === "logos") return { kind: "logos" };
  if (a === "properties" || a === "units") {
    return b && UUID_RE.test(b) ? { kind: "owner", ownerId: b } : { kind: "unknown" };
  }
  if (UUID_RE.test(a)) return { kind: "owner", ownerId: a };
  return { kind: "unknown" };
}

type StaffUser = { userId?: unknown; userType?: unknown; officeId?: unknown };

/**
 * Staff access to files namespaced by an owner user id:
 *  - self (the uploader/owner)
 *  - superadmin
 *  - agency user whose office is linked to the owner (office_owner_links)
 *    or who created the owner account (users.created_by_agency_id)
 * Mirrors the access check in api/contacts/[id]/route.ts.
 */
export async function canAccessOwnerFiles(ds: DataSource, user: StaffUser, ownerId: string): Promise<boolean> {
  const userId = String(user.userId ?? "");
  if (userId === ownerId) return true;
  if (String(user.userType) === "superadmin") return true;
  if (String(user.userType) === "agency") {
    const officeId = user.officeId ? String(user.officeId) : null;
    if (officeId) {
      const linked = await ds.query(
        `SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1`,
        [officeId, ownerId]
      );
      if (Array.isArray(linked) && linked.length > 0) return true;
    }
    const created = await ds.query(
      `SELECT 1 AS ok FROM users WHERE id = $1 AND created_by_agency_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [ownerId, userId]
    );
    return Array.isArray(created) && created.length > 0;
  }
  return false;
}

/**
 * Message attachments: resolvable only if the file belongs to a message in a
 * conversation the staff user participates in.
 */
export async function canAccessMessageFile(ds: DataSource, user: StaffUser, relPath: string): Promise<boolean> {
  const rows = await ds.query(`SELECT conversation_id FROM messages WHERE file_url = $1 LIMIT 1`, [
    `/uploads/${relPath}`,
  ]);
  const conversationId = rows?.[0]?.conversation_id;
  if (!conversationId) return false;
  const participant = await ds.query(
    `SELECT 1 AS ok FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
    [conversationId, String(user.userId ?? "")]
  );
  return Array.isArray(participant) && participant.length > 0;
}
