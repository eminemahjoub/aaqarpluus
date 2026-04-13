import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    if (!officeId) return badRequest("office_id غير موجود");

    const { linkId } = await params;
    const ds = await getDataSource();

    const row = await ds
      .getRepository("OfficeOwnerLink")
      .findOne({ where: { id: linkId, office_id: officeId } as any });
    if (!row) return unauthorized();

    await ds.getRepository("OfficeOwnerLink").delete(linkId);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

