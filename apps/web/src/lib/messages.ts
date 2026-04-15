import type { DataSource } from "typeorm";
import { badRequest, forbidden } from "@/lib/errors";
import { assertAgencyCanAccessProperty } from "@/lib/office-scope";

export async function requireConversationParticipant(args: { ds: DataSource; userId: string; conversationId: string }) {
  const { ds, userId, conversationId } = args;
  const rows = await ds.query(
    `
    SELECT
      c.*,
      cp.id AS participant_id,
      cp.role AS participant_role,
      cp.last_read_at,
      cp.is_muted
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.user_id = $1 AND cp.conversation_id = $2
    LIMIT 1
    `,
    [userId, conversationId]
  );
  const row = rows?.[0];
  if (!row) throw forbidden("غير مصرح");
  return row as any;
}

export async function markConversationRead(args: { ds: DataSource; userId: string; conversationId: string }) {
  const { ds, userId, conversationId } = args;
  await ds.query(
    `UPDATE conversation_participants SET last_read_at = NOW() WHERE user_id = $1 AND conversation_id = $2`,
    [userId, conversationId]
  );
  await ds.query(
    `UPDATE message_notifications SET is_read = true WHERE user_id = $1 AND conversation_id = $2`,
    [userId, conversationId]
  );
}

export async function getPropertyAccessOrThrow(args: {
  ds: DataSource;
  user: { userId: string; userType?: string; officeId?: string | null };
  propertyId: string;
}) {
  const { ds, user, propertyId } = args;
  const userType = String(user.userType ?? "");
  if (userType === "agency") {
    const can = await assertAgencyCanAccessProperty(ds, user, propertyId);
    if (!can) throw forbidden("غير مصرح");
    return;
  }
  const prop = await ds.query(`SELECT id FROM properties WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL LIMIT 1`, [
    propertyId,
    user.userId,
  ]);
  if (!prop?.[0]) throw forbidden("غير مصرح");
}

export async function getUnitAccessOrThrow(args: {
  ds: DataSource;
  user: { userId: string; userType?: string; officeId?: string | null };
  unitId: string;
}) {
  const { ds, user, unitId } = args;
  const unit = await ds.query(
    `SELECT id, property_id FROM units WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [unitId]
  );
  const row = unit?.[0];
  if (!row?.property_id) throw badRequest("الوحدة غير موجودة");
  await getPropertyAccessOrThrow({ ds, user, propertyId: String(row.property_id) });
}

export async function ensureDirectLinkOrThrow(args: {
  ds: DataSource;
  me: { userId: string; userType?: string; officeId?: string | null };
  otherUserId: string;
}) {
  const { ds, me, otherUserId } = args;
  const meType = String(me.userType ?? "");
  const other = await ds.query(`SELECT id, user_type, office_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [
    otherUserId,
  ]);
  const o = other?.[0];
  if (!o) throw badRequest("مشارك غير موجود");
  const otherType = String(o.user_type ?? "");

  // owner<->agency only (based on office_owner_links). We treat "linked row exists" as active.
  if (meType === "owner" && otherType === "agency") {
    const officeId = o.office_id ? String(o.office_id) : null;
    if (!officeId) throw badRequest("حساب المكتب غير مرتبط بمكتب");
    const link = await ds.query(
      `SELECT 1 FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1`,
      [officeId, me.userId]
    );
    if (!link?.[0]) throw forbidden("لا يوجد ربط فعّال مع هذا المكتب");
    return;
  }
  if (meType === "agency" && otherType === "owner") {
    const officeId = me.officeId ? String(me.officeId) : null;
    if (!officeId) throw badRequest("office_id غير موجود");
    const link = await ds.query(
      `SELECT 1 FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1`,
      [officeId, otherUserId]
    );
    if (!link?.[0]) throw forbidden("لا يوجد ربط فعّال مع هذا المالك");
    return;
  }

  throw forbidden("غير مسموح بمحادثة مباشرة بين هذه الحسابات");
}

