export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { badRequest, handleError, unauthorized } from "@/lib/errors";
import { badZod } from "@/lib/validation";
import { markConversationRead, requireConversationParticipant } from "@/lib/messages";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const ds = await getDataSource();

    const row = await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });

    const participants = await ds.query(
      `SELECT u.id, COALESCE(u.full_name, u.email) AS name, cp.role, cp.joined_at, cp.last_read_at, cp.is_muted
       FROM conversation_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.conversation_id = $1 AND u.deleted_at IS NULL
       ORDER BY cp.joined_at ASC`,
      [id]
    );

    const property = row.property_id
      ? (await ds.query(`SELECT id, name FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [row.property_id]))?.[0] ?? null
      : null;
    const unit = row.unit_id
      ? (await ds.query(`SELECT id, label FROM units WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [row.unit_id]))?.[0] ?? null
      : null;

    await markConversationRead({ ds, userId: String(me.userId), conversationId: id });

    return ok({
      id: String(row.id),
      type: String(row.type),
      subject: row.subject ?? null,
      is_archived: Boolean(row.is_archived),
      created_by: String(row.created_by),
      created_at: row.created_at ? String(row.created_at) : null,
      last_message_at: row.last_message_at ? String(row.last_message_at) : null,
      property: property ? { id: String(property.id), name: String(property.name ?? "—") } : null,
      unit: unit ? { id: String(unit.id), label: String(unit.label ?? "—") } : null,
      participants: participants ?? [],
      me: { is_muted: Boolean(row.is_muted), last_read_at: row.last_read_at ? String(row.last_read_at) : null },
    });
  } catch (err) {
    return handleError(err);
  }
}

const UpdateSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  is_archived: z.boolean().optional(),
  is_muted: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const row = await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });

    // subject: only creator
    if (parsed.data.subject !== undefined) {
      if (String(row.created_by) !== String(me.userId)) throw badRequest("فقط منشئ المحادثة يمكنه تغيير العنوان");
      await ds.query(`UPDATE conversations SET subject = $1, updated_at = NOW() WHERE id = $2`, [parsed.data.subject, id]);
      logAudit({ userId: String(me.userId), action: "update", entityType: "conversation", entityId: id, metadata: { subject: true }, req });
    }

    // archive: per-user behavior via participant muting? Spec says archive for themselves; we keep conversation-level is_archived for now.
    if (parsed.data.is_archived !== undefined) {
      await ds.query(`UPDATE conversations SET is_archived = $1, updated_at = NOW() WHERE id = $2`, [parsed.data.is_archived, id]);
      logAudit({ userId: String(me.userId), action: "update", entityType: "conversation", entityId: id, metadata: { is_archived: parsed.data.is_archived }, req });
    }

    if (parsed.data.is_muted !== undefined) {
      await ds.query(`UPDATE conversation_participants SET is_muted = $1 WHERE user_id = $2 AND conversation_id = $3`, [
        parsed.data.is_muted,
        String(me.userId),
        id,
      ]);
      logAudit({ userId: String(me.userId), action: "update", entityType: "conversation_participant", entityId: `${id}:${me.userId}`, metadata: { is_muted: parsed.data.is_muted }, req });
    }

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const ds = await getDataSource();
    await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });

    await ds.query(`DELETE FROM conversation_participants WHERE user_id = $1 AND conversation_id = $2`, [String(me.userId), id]);
    const remaining = await ds.query(`SELECT COUNT(*)::int AS c FROM conversation_participants WHERE conversation_id = $1`, [id]);
    if (Number(remaining?.[0]?.c ?? 0) <= 0) {
      await ds.query(`UPDATE conversations SET is_archived = true, updated_at = NOW() WHERE id = $1`, [id]);
    }

    logAudit({ userId: String(me.userId), action: "delete", entityType: "conversation_participant", entityId: `${id}:${me.userId}`, req });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

