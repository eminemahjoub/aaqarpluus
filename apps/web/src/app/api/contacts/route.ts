import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok, created, badRequest, unauthorized } from "@/lib/api-helpers";
import { getAccessiblePropertyIds } from "@/lib/office-scope";
import { handleError, unauthorized as throwUnauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) throw throwUnauthorized();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const page = parsePagination(searchParams);
    const search = page?.search ?? (searchParams.get("q")?.trim() ? searchParams.get("q")!.trim() : null);

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // For agencies: only contacts linked to contracts on accessible properties.
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok(page ? paginated({ items: [], total: 0, page: page.page, limit: page.limit, search }) : []);

      const params: any[] = [propertyIds];
      let idx = 2;
      let where = "";
      if (type) {
        where += ` AND c.type = $${idx++}`;
        params.push(type);
      }
      if (search) {
        where += ` AND (c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.alternative_phone ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }

      if (!page) {
        const rows = await ds.query(
          `SELECT DISTINCT c.*
           FROM contacts c
           JOIN contracts ct ON ct.contact_id = c.id
           WHERE ct.property_id = ANY($1) AND c.deleted_at IS NULL ${where}
           ORDER BY c.created_at DESC`,
          params
        );
        return ok(rows ?? []);
      }

      const totalRows = await ds.query(
        `SELECT COUNT(DISTINCT c.id)::int AS total
         FROM contacts c
         JOIN contracts ct ON ct.contact_id = c.id
         WHERE ct.property_id = ANY($1) AND c.deleted_at IS NULL ${where}`,
        params
      );
      const total = Number(totalRows?.[0]?.total ?? 0) || 0;

      params.push(page.limit, page.offset);
      const rows = await ds.query(
        `SELECT DISTINCT c.*
         FROM contacts c
         JOIN contracts ct ON ct.contact_id = c.id
         WHERE ct.property_id = ANY($1) AND c.deleted_at IS NULL ${where}
         ORDER BY c.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        params
      );
      return ok(paginated({ items: rows ?? [], total, page: page.page, limit: page.limit, search }));
    }

    let qb = ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.owner_id = :ownerId", { ownerId: user.userId })
      .andWhere("c.deleted_at IS NULL")
      .orderBy("c.created_at", "DESC");

    if (type) qb = qb.andWhere("c.type = :type", { type });
    if (search) qb = qb.andWhere("(c.name ILIKE :q OR c.phone ILIKE :q OR c.alternative_phone ILIKE :q)", { q: `%${search}%` });

    if (!page) {
      const contacts = await qb.getMany();
      return ok(contacts);
    }
    const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
    return ok(paginated({ items, total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
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
    let ownerId = String(user.userId);
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    if (Array.isArray(propertyIds)) {
      const ownerIdRaw = typeof body.owner_id === "string" ? body.owner_id.trim() : "";
      if (!ownerIdRaw) return badRequest("معرّف المالك مطلوب");
      const officeId = user.officeId ? String(user.officeId) : null;
      if (!officeId) return badRequest("office_id غير موجود");
      const linked = await ds.query(
        "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
        [officeId, ownerIdRaw]
      );
      if (!Array.isArray(linked) || linked.length === 0) return unauthorized();
      ownerId = ownerIdRaw;
    }

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
    return handleError(err);
  }
}
