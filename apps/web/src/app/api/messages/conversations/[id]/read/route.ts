export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { handleError, unauthorized } from "@/lib/errors";
import { markConversationRead, requireConversationParticipant } from "@/lib/messages";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const ds = await getDataSource();
    await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });
    await markConversationRead({ ds, userId: String(me.userId), conversationId: id });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

