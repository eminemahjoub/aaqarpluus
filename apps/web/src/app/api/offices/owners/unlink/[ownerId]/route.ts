import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ ownerId: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();

    const { ownerId } = await params;
    const agencyId = String(user.userId);

    const ds = await getDataSource();

    // Verify this owner was created by the current agency
    const owner = await ds
      .getRepository("User")
      .findOne({
        where: {
          id: ownerId,
          created_by_agency_id: agencyId,
          user_type: "owner",
        } as any,
      });

    if (!owner) return unauthorized();

    // Clear the created_by_agency_id to unlink
    await ds.getRepository("User").update(ownerId, { created_by_agency_id: null } as any);

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
