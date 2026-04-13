import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessiblePropertyIds } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // For agencies: only contacts linked to contracts on accessible properties.
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      const rows = await ds.query(
        `SELECT DISTINCT c.*
         FROM contacts c
         JOIN contracts ct ON ct.contact_id = c.id
         WHERE ct.property_id = ANY($1)
         ORDER BY c.created_at DESC`,
        [propertyIds]
      );
      const filtered = type ? (rows ?? []).filter((c: any) => String(c.type ?? "") === String(type)) : rows;
      return ok(filtered ?? []);
    }

    let qb = ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.owner_id = :ownerId", { ownerId: user.userId })
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

    if (String(user.userType ?? "") === "agency") return unauthorized();

    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");
    const ownerId = String(user.userId);

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
