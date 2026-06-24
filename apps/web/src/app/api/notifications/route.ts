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
    const notifications = await ds
      .getRepository("Notification")
      .createQueryBuilder("n")
      .where("n.user_id = :userId", { userId: user.userId })
      .orderBy("n.created_at", "DESC")
      .limit(50)
      .getMany();

    const unreadCount = await ds
      .getRepository("Notification")
      .createQueryBuilder("n")
      .where("n.user_id = :userId AND n.is_read = false", { userId: user.userId })
      .getCount();

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

    if (parsed.data.all) {
      await repo.update({ user_id: user.userId } as any, { is_read: true });
    } else if (parsed.data.id) {
      await repo.update({ id: parsed.data.id, user_id: user.userId } as any, { is_read: true });
    }

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
