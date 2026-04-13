import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    if (!user.officeId) return badRequest("office_id غير موجود");

    const ds = await getDataSource();
    const office = await ds.getRepository("Office").findOne({ where: { id: String(user.officeId) } as any });
    if (!office) return badRequest("المكتب غير موجود");
    return ok(office);
  } catch (err) {
    return serverError(err);
  }
}

