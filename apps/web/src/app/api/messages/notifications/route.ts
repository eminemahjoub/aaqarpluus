export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { badRequest, handleError, unauthorized } from "@/lib/errors";
import { badZod, UuidSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const ds = await getDataSource();

    const rows = await ds.query(
      `SELECT conversation_id, COUNT(*)::int AS c
       FROM message_notifications
       WHERE user_id = $1 AND is_read = false
       GROUP BY conversation_id`,
      [String(me.userId)]
    );

    const conversations: Record<string, number> = {};
    let totalUnread = 0;
    for (const r of rows ?? []) {
      const id = String(r.conversation_id);
      const c = Number(r.c ?? 0);
      conversations[id] = c;
      totalUnread += c;
    }

    return ok({ totalUnread, conversations });
  } catch (err) {
    return handleError(err);
  }
}

const MarkReadSchema = z.object({ conversation_id: UuidSchema.optional() });

export async function PUT(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const body = await req.json();
    const parsed = MarkReadSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    if (parsed.data.conversation_id) {
      await ds.query(`UPDATE message_notifications SET is_read = true WHERE user_id = $1 AND conversation_id = $2`, [
        String(me.userId),
        String(parsed.data.conversation_id),
      ]);
    } else {
      await ds.query(`UPDATE message_notifications SET is_read = true WHERE user_id = $1`, [String(me.userId)]);
    }
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

