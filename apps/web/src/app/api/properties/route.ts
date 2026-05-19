import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { denyIfOwnerCannotMutateProperties } from "@/lib/mutate-guard";
import { getAccessiblePropertyIds } from "@/lib/office-scope";
import { z } from "zod";
import { CommissionPercentSchema, UuidSchema, badZod } from "@/lib/validation";
import { parsePagination, paginated } from "@/lib/pagination";
import {
  buildOwnerContractSummary,
  ownerHidesTenantPii,
  paymentsByContractId,
} from "@/lib/owner-tenant-privacy";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);
    const page = parsePagination(searchParams);
    const search = page?.search ?? null;

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let properties: any[] = [];
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok(page ? paginated({ items: [], total: 0, page: page.page, limit: page.limit, search }) : []);
      let qb = ds
        .getRepository("Property")
        .createQueryBuilder("p")
        .where("p.id IN (:...propertyIds)", { propertyIds })
        .andWhere("p.deleted_at IS NULL")
        .orderBy("p.created_at", "DESC");
      if (search) qb = qb.andWhere("(p.name ILIKE :q OR p.city ILIKE :q OR p.neighborhood ILIKE :q)", { q: `%${search}%` });
      if (!page) {
        properties = await qb.getMany();
      } else {
        const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
        properties = items;
        // We'll return paginated wrapper at the end.
        Object.defineProperty(properties, "__pagination", { value: { total, page: page.page, limit: page.limit, search }, enumerable: false });
      }
    } else {
      let qb = ds
        .getRepository("Property")
        .createQueryBuilder("p")
        .where("p.owner_id = :ownerId", { ownerId: user.userId })
        .andWhere("p.deleted_at IS NULL")
        .orderBy("p.created_at", "DESC");
      if (search) qb = qb.andWhere("(p.name ILIKE :q OR p.city ILIKE :q OR p.neighborhood ILIKE :q)", { q: `%${search}%` });
      if (!page) {
        properties = await qb.getMany();
      } else {
        const [items, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();
        properties = items;
        Object.defineProperty(properties, "__pagination", { value: { total, page: page.page, limit: page.limit, search }, enumerable: false });
      }
    }

    // Attach active contract info per property
    const propIds = properties.map((p: any) => p.id).filter(Boolean);
    const today = new Date().toISOString().split("T")[0];

    // Attach owner info (useful for agency view)
    let ownerMap: Record<string, { full_name: string | null; phone: string | null }> = {};
    const ownerIdsForMap = Array.from(new Set(properties.map((p: any) => String(p.owner_id)).filter(Boolean)));
    if (ownerIdsForMap.length > 0) {
      const owners = await ds.query(
        `SELECT id, full_name, phone FROM users WHERE id = ANY($1)`,
        [ownerIdsForMap]
      );
      for (const row of owners ?? []) {
        if (row?.id) ownerMap[String(row.id)] = { full_name: row.full_name ? String(row.full_name) : null, phone: row.phone ? String(row.phone) : null };
      }
    }

    let contractMap: Record<string, any> = {};
    const hidePii = ownerHidesTenantPii(user);
    if (propIds.length > 0) {
      const contracts = await ds
        .getRepository("Contract")
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.contact", "contact")
        .leftJoinAndSelect("c.unit", "unit")
        .where("c.property_id IN (:...propIds)", { propIds })
        .andWhere("c.status = :status", { status: "active" })
        .andWhere("c.start_date <= :today", { today })
        .andWhere("c.end_date >= :today", { today })
        .orderBy("c.start_date", "DESC")
        .getMany();

      const contractIds = contracts.map((c: any) => String(c.id)).filter(Boolean);
      const payMap = hidePii ? await paymentsByContractId(ds, contractIds) : {};

      for (const c of contracts) {
        const pid = (c as any).property_id;
        if (!pid || contractMap[pid]) continue;
        if (hidePii) {
          contractMap[pid] = buildOwnerContractSummary({
            end_date: (c as any).end_date,
            start_date: (c as any).start_date,
            unit_label: (c as any).unit?.label,
            payments: payMap[String(c.id)] ?? [],
          });
        } else {
          contractMap[pid] = {
            contact_name: (c as any).contact?.name ?? "—",
            contact_phone: (c as any).contact?.phone ?? null,
            unit_label: (c as any).unit?.label ?? "—",
            start_date: (c as any).start_date ?? "—",
            end_date: (c as any).end_date ?? "—",
          };
        }
      }
    }

    // Fetch cover image per property for thumbnail (prefer image_type='cover', fallback to first)
    let coverMap: Record<string, string> = {};
    if (propIds.length > 0) {
      const ownerIds = Array.from(new Set(properties.map((p: any) => String(p.owner_id)).filter(Boolean)));
      const covers = await ds.query(
        `SELECT DISTINCT ON (property_id) property_id, public_url
         FROM property_images
         WHERE property_id = ANY($1) AND owner_id = ANY($2)
         ORDER BY property_id, (CASE WHEN image_type = 'cover' THEN 0 ELSE 1 END), created_at ASC`,
        [propIds, ownerIds]
      );
      for (const row of covers) {
        if (row.property_id) coverMap[String(row.property_id)] = String(row.public_url);
      }
    }

    // Attach managing office info (useful for owner view)
    let officeMap: Record<string, { name: string; phone: string | null; email: string | null }> = {};
    const officeIdsForMap = Array.from(
      new Set(properties.map((p: any) => (p.managing_office_id ? String(p.managing_office_id) : "")).filter(Boolean))
    );
    if (officeIdsForMap.length > 0) {
      const offices = await ds.query(
        `
        SELECT
          o.id AS office_id,
          o.name AS office_name,
          u.phone AS office_phone,
          u.email AS office_email
        FROM offices o
        LEFT JOIN LATERAL (
          SELECT uu.phone, uu.email
          FROM users uu
          WHERE uu.office_id = o.id AND uu.user_type = 'agency'
          ORDER BY uu.created_at ASC
          LIMIT 1
        ) u ON TRUE
        WHERE o.id = ANY($1)
        `,
        [officeIdsForMap]
      );
      for (const row of offices ?? []) {
        if (!row?.office_id) continue;
        officeMap[String(row.office_id)] = {
          name: String(row.office_name ?? "—"),
          phone: row.office_phone ? String(row.office_phone) : null,
          email: row.office_email ? String(row.office_email) : null,
        };
      }
    }

    const result = properties.map((p: any) => ({
      ...p,
      active_contract: contractMap[p.id] ?? null,
      cover_url: coverMap[p.id] ?? null,
      owner_name: ownerMap[String(p.owner_id)]?.full_name ?? null,
      owner_phone: ownerMap[String(p.owner_id)]?.phone ?? null,
      managing_office_name: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.name ?? null : null,
      managing_office_phone: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.phone ?? null : null,
      managing_office_email: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.email ?? null : null,
    }));

    const meta = (properties as any).__pagination as any | undefined;
    if (meta?.page && meta?.limit !== undefined) {
      return ok(paginated({ items: result, total: Number(meta.total) || 0, page: meta.page, limit: meta.limit, search: meta.search }));
    }
    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}

const CreatePropertySchema = z.object({
  owner_id: z.string().optional(),
  name: z.string().trim().min(1),
  title: z.string().trim().nullable().optional(),
  status: z.string().optional(),
  region: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  property_model_type: z.string().nullable().optional(),
  apartments_count: z.number().or(z.string()).optional(),
  shops_count: z.number().or(z.string()).optional(),
  other_units_count: z.number().or(z.string()).optional(),
  unit_identifiers: z.string().nullable().optional(),
  units_count: z.number().or(z.string()).optional(),
  area_m2: z.number().or(z.string()).nullable().optional(),
  property_cost: z.number().or(z.string()).nullable().optional(),
  water_account: z.string().nullable().optional(),
  electricity_account: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  payment_frequency: z.string().nullable().optional(),
  lessor_type: z.enum(["office", "owner"]).nullable().optional(),
  lessor_contact_id: z.string().nullable().optional(),
  managing_office_id: z.string().nullable().optional(),
  commission_percent: z.any().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const readOnly = denyIfOwnerCannotMutateProperties(user);
    if (readOnly) return readOnly;

    const body = await req.json();
    const parsed = CreatePropertySchema.safeParse(body);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    if (!parsed.data.name?.trim()) return badRequest("اسم العقار مطلوب");

    const isUuid = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    const lessorType = body.lessor_type === "office" || body.lessor_type === "owner" ? body.lessor_type : null;
    const lessorContactIdRaw = typeof body.lessor_contact_id === "string" ? body.lessor_contact_id.trim() : "";
    const lessorContactId = lessorType === "office" && lessorContactIdRaw ? lessorContactIdRaw : null;
    if (lessorContactId && !isUuid(lessorContactId)) return badRequest("معرّف جهة الاتصال (المؤجر) غير صحيح");

    const commissionPercentRaw =
      body.commission_percent !== undefined && body.commission_percent !== null && body.commission_percent !== ""
        ? CommissionPercentSchema.safeParse(body.commission_percent).success
          ? Number(CommissionPercentSchema.parse(body.commission_percent))
          : null
        : null;
    if (body.commission_percent !== undefined && body.commission_percent !== null && body.commission_percent !== "" && commissionPercentRaw === null) {
      return badRequest("نسبة العمولة غير صحيحة");
    }

    const ds = await getDataSource();
    const repo = ds.getRepository("Property");
    const userType = String(user.userType ?? "");

    // Agency can create a property for a linked owner, and auto-assign itself to manage it.
    if (userType === "agency") {
      const officeId = user.officeId ? String(user.officeId) : null;
      if (!officeId) return badRequest("office_id غير موجود");

      const ownerIdRaw = typeof body.owner_id === "string" ? body.owner_id.trim() : "";
      if (!ownerIdRaw || !isUuid(ownerIdRaw)) return badRequest("يرجى اختيار المالك");

      const linked = await ds.query(
        "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
        [officeId, ownerIdRaw]
      );
      if (!Array.isArray(linked) || linked.length === 0) return unauthorized();

      if (commissionPercentRaw === null) return badRequest("نسبة العمولة مطلوبة");

      const property = repo.create({
        owner_id: ownerIdRaw,
        managing_office_id: officeId,
        name: body.name.trim(),
        title: body.title?.trim() || null,
        status: body.status ?? "vacant",
        property_model_type: body.property_model_type ?? null,
        region: body.region ?? null,
        city: body.city ?? null,
        neighborhood: body.neighborhood ?? null,
        address: body.address?.trim() || null,
        latitude: body.latitude !== undefined && body.latitude !== null && body.latitude !== "" ? Number(body.latitude) : null,
        longitude: body.longitude !== undefined && body.longitude !== null && body.longitude !== "" ? Number(body.longitude) : null,
        area_m2: body.area_m2 ? Number(body.area_m2) : null,
        property_cost: body.property_cost ? Number(body.property_cost) : null,
        units_count: body.units_count ?? 0,
        apartments_count: body.apartments_count ?? 0,
        shops_count: body.shops_count ?? 0,
        other_units_count: body.other_units_count ?? 0,
        unit_identifiers: body.unit_identifiers ?? null,
        title_deed_number: body.title_deed_number ?? null,
        water_account: body.water_account ?? null,
        electricity_account: body.electricity_account ?? null,
        description: body.description ?? null,
        payment_frequency: body.payment_frequency?.trim() || null,
        lessor_type: lessorType,
        lessor_contact_id: lessorContactId,
        commission_percent: commissionPercentRaw,
      } as any);

      await repo.save(property);

      await ds.query(
        `
        INSERT INTO office_property_links (office_id, owner_id, property_id, commission_percent, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
        `,
        [officeId, ownerIdRaw, String((property as any).id), commissionPercentRaw]
      );

      return created(property);
    }

    // Owner flow (existing)
    const managingOfficeIdRaw = typeof body.managing_office_id === "string" ? body.managing_office_id.trim() : "";
    const managingOfficeId = managingOfficeIdRaw ? managingOfficeIdRaw : null;
    if (managingOfficeId && !isUuid(managingOfficeId)) return badRequest("معرّف المكتب غير صحيح");

    const ownerId = String(user.userId);
    const property = repo.create({
      owner_id: ownerId,
      managing_office_id: managingOfficeId,
      name: body.name.trim(),
      title: body.title?.trim() || null,
      status: body.status ?? "vacant",
      property_model_type: body.property_model_type ?? null,
      region: body.region ?? null,
      city: body.city ?? null,
      neighborhood: body.neighborhood ?? null,
      address: body.address?.trim() || null,
      latitude: body.latitude !== undefined && body.latitude !== null && body.latitude !== "" ? Number(body.latitude) : null,
      longitude: body.longitude !== undefined && body.longitude !== null && body.longitude !== "" ? Number(body.longitude) : null,
      area_m2: body.area_m2 ? Number(body.area_m2) : null,
      property_cost: body.property_cost ? Number(body.property_cost) : null,
      units_count: body.units_count ?? 0,
      apartments_count: body.apartments_count ?? 0,
      shops_count: body.shops_count ?? 0,
      other_units_count: body.other_units_count ?? 0,
      unit_identifiers: body.unit_identifiers ?? null,
      title_deed_number: body.title_deed_number ?? null,
      water_account: body.water_account ?? null,
      electricity_account: body.electricity_account ?? null,
      description: body.description ?? null,
      payment_frequency: body.payment_frequency?.trim() || null,
      lessor_type: lessorType,
      lessor_contact_id: lessorContactId,
      commission_percent: commissionPercentRaw,
    } as any);

    await repo.save(property);

    // If owner assigned a managing office, create/update the link so the agency can access the property.
    const managingOfficeIdSaved = (property as any).managing_office_id ? String((property as any).managing_office_id) : null;
    if (managingOfficeIdSaved) {
      const commission =
        (property as any).commission_percent !== undefined && (property as any).commission_percent !== null && (property as any).commission_percent !== ""
          ? Number((property as any).commission_percent)
          : null;
      await ds.query(
        `
        INSERT INTO office_property_links (office_id, owner_id, property_id, commission_percent, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
        `,
        [managingOfficeIdSaved, ownerId, String((property as any).id), commission]
      );
    }

    return created(property);
  } catch (err) {
    return serverError(err);
  }
}
