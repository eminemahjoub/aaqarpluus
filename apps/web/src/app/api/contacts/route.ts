import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok, created, badRequest, unauthorized } from "@/lib/api-helpers";
import { handleError, unauthorized as throwUnauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import { ownerHidesTenantPii, sanitizeContactForOwner } from "@/lib/owner-tenant-privacy";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) throw throwUnauthorized();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const page = parsePagination(searchParams);
    const search = page?.search ?? (searchParams.get("q")?.trim() ? searchParams.get("q")!.trim() : null);

    const ds = await getDataSource();
    const userType = String(user.userType ?? "");

    // For agencies: contacts where owner_id is the agency or an owner created by the agency.
    if (userType === "agency") {
      const agencyId = String(user.userId);
      const params: any[] = [agencyId];
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

      const baseQuery = `
        SELECT c.* FROM contacts c
        WHERE c.deleted_at IS NULL
          AND (c.owner_id = $1 OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = c.owner_id
              AND u.created_by_agency_id = $1
              AND u.deleted_at IS NULL
          )) ${where}
        ORDER BY c.created_at DESC`;

      if (!page) {
        const rows = await ds.query(baseQuery, params);
        const items = (rows ?? []).map((r: Record<string, unknown>) =>
          ownerHidesTenantPii(user) ? sanitizeContactForOwner(r) : r
        );
        return ok(items);
      }

      const countQuery = `SELECT COUNT(*)::int AS total FROM contacts c
        WHERE c.deleted_at IS NULL
          AND (c.owner_id = $1 OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = c.owner_id
              AND u.created_by_agency_id = $1
              AND u.deleted_at IS NULL
          )) ${where}`;
      const totalRows = await ds.query(countQuery, params);
      const total = Number(totalRows?.[0]?.total ?? 0) || 0;

      params.push(page.limit, page.offset);
      const rows = await ds.query(baseQuery + ` LIMIT $${idx++} OFFSET $${idx++}`, params);
      const agencyItems = (rows ?? []).map((r: Record<string, unknown>) =>
        ownerHidesTenantPii(user) ? sanitizeContactForOwner(r) : r
      );
      return ok(paginated({ items: agencyItems, total, page: page.page, limit: page.limit, search }));
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
      const mapped = contacts.map((c) =>
        ownerHidesTenantPii(user) ? sanitizeContactForOwner(c as Record<string, unknown>) : c
      );
      return ok(mapped);
    }
    const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
    const mappedItems = items.map((c) =>
      ownerHidesTenantPii(user) ? sanitizeContactForOwner(c as Record<string, unknown>) : c
    );
    return ok(paginated({ items: mappedItems, total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    if (ownerHidesTenantPii(user) && String(body?.type ?? "tenant") === "tenant") {
      return unauthorized();
    }
    if (!body.name?.trim()) return badRequest("الاسم مطلوب");

    const isTenant = String(body?.type ?? "tenant") === "tenant";
    if (isTenant) {
      if (body.sex && !["ذكر", "أنثى"].includes(body.sex)) return badRequest("الجنس يجب أن يكون ذكر أو أنثى");
    }

    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");
    let ownerId = String(user.userId);
    const userType = String(user.userType ?? "");
    if (userType === "agency") {
      const ownerIdRaw = typeof body.owner_id === "string" ? body.owner_id.trim() : "";
      if (!ownerIdRaw) return badRequest("معرّف المالك مطلوب");
      const officeId = user.officeId ? String(user.officeId) : null;
      if (officeId) {
        const linked = await ds.query(
          "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
          [officeId, ownerIdRaw]
        );
        if (!Array.isArray(linked) || linked.length === 0) return unauthorized();
      } else {
        // Agency without office: verify owner was created by this agency
        const ownerRow = await ds.query(
          `SELECT 1 AS ok FROM users u
           WHERE u.id = $1 AND u.created_by_agency_id = $2 AND u.deleted_at IS NULL
           LIMIT 1`,
          [ownerIdRaw, user.userId]
        );
        if (!Array.isArray(ownerRow) || ownerRow.length === 0) return unauthorized();
      }
      ownerId = ownerIdRaw;
    }

    const contact = repo.create({
      owner_id: ownerId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      alternative_phone: body.alternative_phone?.trim() || null,
      sex: isTenant ? (body.sex?.trim() || null) : null,
      id_number: isTenant ? (body.id_number?.trim() || null) : null,
      type: body.type ?? "tenant",
      status: body.status ?? "active",
    });

    await repo.save(contact);
    return created(contact);
  } catch (err) {
    return handleError(err);
  }
}
