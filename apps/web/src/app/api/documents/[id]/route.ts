import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Document");

    const doc = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!doc) return unauthorized();

    // Remove physical file if local
    if ((doc as any).object_path && (doc as any).bucket === "local") {
      try {
        await unlink((doc as any).object_path);
      } catch {
        // ignore file not found errors
      }
    }

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
