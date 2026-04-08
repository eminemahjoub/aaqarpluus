import { NextRequest } from "next/server";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { getDataSource } from "@/lib/db/data-source";

export async function GET(req: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(req);
    if (!jwtUser) return unauthorized();

    const ds = await getDataSource();
    const user = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.id = :id", { id: jwtUser.userId })
      .getOne();

    if (!user) return unauthorized();

    return ok({
      id: (user as any).id,
      email: (user as any).email,
      fullName: (user as any).full_name,
      phone: (user as any).phone,
      userType: (user as any).user_type,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(req);
    if (!jwtUser) return unauthorized();

    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("User");

    await repo.update(jwtUser.userId, {
      full_name: body.fullName ?? undefined,
      phone: body.phone ?? undefined,
    } as any);

    const user = await repo.findOne({ where: { id: jwtUser.userId } as any });
    return ok({
      id: (user as any).id,
      email: (user as any).email,
      fullName: (user as any).full_name,
      phone: (user as any).phone,
      userType: (user as any).user_type,
    });
  } catch (err) {
    return serverError(err);
  }
}
