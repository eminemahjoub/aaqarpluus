import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { badRequest, forbidden, handleError, unauthorized } from "@/lib/errors";
import { badZod } from "@/lib/validation";
import { requireConversationParticipant } from "@/lib/messages";
import { logAudit } from "@/lib/audit";

const EditSchema = z.object({ content: z.string().trim().max(5000) });

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id, messageId } = await params;
    const body = await req.json();
    const parsed = EditSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });

    const rows = await ds.query(
      `SELECT id, sender_id, type, created_at, is_deleted FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
      [messageId, id]
    );
    const m = rows?.[0];
    if (!m) throw badRequest("الرسالة غير موجودة");
    if (Boolean(m.is_deleted)) throw badRequest("لا يمكن تعديل رسالة محذوفة");
    if (String(m.sender_id) !== String(me.userId)) throw forbidden("فقط المرسل يمكنه التعديل");
    if (String(m.type) !== "text") throw badRequest("فقط الرسائل النصية قابلة للتعديل");

    const createdAt = new Date(String(m.created_at));
    if (Date.now() - createdAt.getTime() > 15 * 60 * 1000) throw badRequest("انتهت مدة التعديل (15 دقيقة)");

    await ds.query(`UPDATE messages SET content = $1, is_edited = true, edited_at = NOW(), updated_at = NOW() WHERE id = $2`, [
      parsed.data.content.trim(),
      messageId,
    ]);

    logAudit({ userId: String(me.userId), action: "update", entityType: "message", entityId: messageId, metadata: { conversation_id: id }, req });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id, messageId } = await params;
    const ds = await getDataSource();
    await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });

    const rows = await ds.query(
      `SELECT id, sender_id, is_deleted FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
      [messageId, id]
    );
    const m = rows?.[0];
    if (!m) throw badRequest("الرسالة غير موجودة");
    if (String(m.sender_id) !== String(me.userId)) throw forbidden("فقط المرسل يمكنه الحذف");

    await ds.query(
      `UPDATE messages SET is_deleted = true, content = NULL, file_url = NULL, file_name = NULL, file_size = NULL, file_type = NULL, updated_at = NOW() WHERE id = $1`,
      [messageId]
    );

    logAudit({ userId: String(me.userId), action: "delete", entityType: "message", entityId: messageId, metadata: { conversation_id: id }, req });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

