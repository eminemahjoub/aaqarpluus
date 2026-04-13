import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessibleOwnerIds, assertAgencyCanAccessOwner } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const ds = await getDataSource();
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return ok([]);
    let qb = ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.owner_id IN (:...ownerIds)", { ownerIds })
      .orderBy("c.created_at", "DESC");

    if (type) qb = qb.andWhere("c.type = :type", { type });

    const contacts = await qb.getMany();
    return ok(contacts);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    if (!body.name?.trim()) return badRequest("الاسم مطلوب");

    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");
    const ownerId = String(body.owner_id ?? user.userId);
    const can = await assertAgencyCanAccessOwner(ds, user, ownerId);
    if (!can) return unauthorized();

    const contact = repo.create({
      owner_id: ownerId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      alternative_phone: body.alternative_phone?.trim() || null,
      type: body.type ?? "tenant",
      status: body.status ?? "active",
    } as any);

    await repo.save(contact);
    return created(contact);
  } catch (err) {
    return serverError(err);
  }
}
