export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok, unauthorized, serverError, badRequest } from "@/lib/api-helpers";
import { z } from "zod";
import { badZod, UuidSchema } from "@/lib/validation";

const MarkReadSchema = z.object({
  id: UuidSchema.optional(),
  all: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const [general, messages] = await Promise.all([
      ds
        .getRepository("Notification")
        .createQueryBuilder("n")
        .where("n.user_id = :userId", { userId: user.userId })
        .orderBy("n.created_at", "DESC")
        .limit(50)
        .getMany(),
      ds
        .getRepository("MessageNotification")
        .createQueryBuilder("mn")
        .where("mn.user_id = :userId", { userId: user.userId })
        .orderBy("mn.created_at", "DESC")
        .limit(50)
        .getMany(),
    ]);

    const mappedMessages = (messages ?? []).map((m) => {
      const raw = m as any;
      return {
        id: String(raw.id),
        user_id: user.userId,
        type: "message",
        title: "رسالة جديدة",
        body: "لديك رسالة جديدة في محادثة",
        reference_id: raw.conversation_id ? String(raw.conversation_id) : null,
        reference_type: "conversation",
        is_read: Boolean(raw.is_read),
        created_at: raw.created_at,
      };
    });

    const notifications = [...general, ...mappedMessages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return ok({ notifications, unreadCount });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const raw = await req.json();
    const parsed = MarkReadSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const repo = ds.getRepository("Notification");
    const messageRepo = ds.getRepository("MessageNotification");

    if (parsed.data.all) {
      await repo.update({ user_id: user.userId } as Record<string, unknown>, { is_read: true });
      await messageRepo.update({ user_id: user.userId } as Record<string, unknown>, { is_read: true });
    } else if (parsed.data.id) {
      await repo.update({ id: parsed.data.id, user_id: user.userId } as Record<string, unknown>, { is_read: true });
      await messageRepo.update({ id: parsed.data.id, user_id: user.userId } as Record<string, unknown>, { is_read: true });
    }

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
