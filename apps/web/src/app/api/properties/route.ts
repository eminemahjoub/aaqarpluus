export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { denyIfOwnerCannotMutateProperties } from "@/lib/mutate-guard";
import { z } from "zod";
import { CommissionPercentSchema, badZod } from "@/lib/validation";
import { jsonResponse, AppError } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import {
  buildOwnerContractSummary,
  ownerHidesTenantPii,
  paymentsByContractId,
} from "@/lib/owner-tenant-privacy";
import { log } from "@/lib/logger";
import { frequencyToEnglish, frequencyToArabic } from "@/lib/validation/contracts";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);
    const page = parsePagination(searchParams);
    const search = page?.search ?? null;

    const userType = String(user.userType ?? "");
    let properties: any[] = [];

    if (userType === "agency") {
      const officeId = user.officeId ? String(user.officeId) : null;
      const agencyId = String(user.userId);
      if (!officeId) {
        // Agency without office: fetch properties created by this agency,
        // owned directly by the agency, or whose owner was created by this agency
        let qb = ds
          .getRepository("Property")
          .createQueryBuilder("p")
          .where(
            `(p.created_by_agency_id = :agencyId
             OR p.owner_id = :agencyId
             OR EXISTS (
               SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = :agencyId
                 AND u.deleted_at IS NULL
             ))`,
            { agencyId }
          )
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
      } else {
        // Agency with office: same logic — query by agency ownership
        let qb = ds
          .getRepository("Property")
          .createQueryBuilder("p")
          .where(
            `(p.created_by_agency_id = :agencyId
             OR p.owner_id = :agencyId
             OR EXISTS (
               SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = :agencyId
                 AND u.deleted_at IS NULL
             ))`,
            { agencyId }
          )
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
    } else {
      // Owner path
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

    const propIds = properties.map((p: { id?: string }) => p.id).filter(Boolean);
    const today = new Date().toISOString().split("T")[0];
    const hidePii = ownerHidesTenantPii(user);

    // Parallelize independent enrichment lookups to eliminate N+1 sequential delay
    const [ownerMap, contractMap, coverMap, officeMap] = await Promise.all([
      // Owners
      (async () => {
        const map: Record<string, { full_name: string | null; phone: string | null }> = {};
        const ownerIds = Array.from(new Set(properties.map((p: { owner_id?: string }) => String(p.owner_id)).filter(Boolean)));
        if (ownerIds.length > 0) {
          const rows = await ds.query(`SELECT id, full_name, phone FROM users WHERE id = ANY($1)`, [ownerIds]);
          for (const row of rows ?? []) {
            if (row?.id) map[String(row.id)] = { full_name: row.full_name ? String(row.full_name) : null, phone: row.phone ? String(row.phone) : null };
          }
        }
        return map;
      })(),

      // Active contracts
      (async () => {
        const map: Record<string, unknown> = {};
        if (propIds.length === 0) return map;
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

        const contractIds = contracts.map((c: { id?: string }) => String(c.id)).filter(Boolean);
        const payMap = hidePii ? await paymentsByContractId(ds, contractIds) : {};

        for (const c of contracts) {
          const cc = c as {
            property_id?: string;
            end_date?: string;
            start_date?: string;
            unit?: { label?: string };
            contact?: { name?: string; phone?: string };
            id?: string;
          };
          const pid = cc.property_id;
          if (!pid || map[pid]) continue;
          if (hidePii) {
            map[pid] = buildOwnerContractSummary({
              end_date: cc.end_date,
              start_date: cc.start_date,
              unit_label: cc.unit?.label,
              payments: payMap[String(cc.id)] ?? [],
            });
          } else {
            map[pid] = {
              contact_name: cc.contact?.name ?? "—",
              contact_phone: cc.contact?.phone ?? null,
              unit_label: cc.unit?.label ?? "—",
              start_date: cc.start_date ?? "—",
              end_date: cc.end_date ?? "—",
            };
          }
        }
        return map;
      })(),

      // Cover images
      (async () => {
        const map: Record<string, string> = {};
        if (propIds.length === 0) return map;
        const ownerIds = Array.from(new Set(properties.map((p: { owner_id?: string }) => String(p.owner_id)).filter(Boolean)));
        const covers = await ds.query(
          `SELECT DISTINCT ON (property_id) property_id, public_url
           FROM property_images
           WHERE property_id = ANY($1) AND owner_id = ANY($2)
           ORDER BY property_id, (CASE WHEN image_type = 'cover' THEN 0 ELSE 1 END), created_at ASC`,
          [propIds, ownerIds]
        );
        for (const row of covers) {
          if (row.property_id) map[String(row.property_id)] = String(row.public_url);
        }
        return map;
      })(),

      // Managing offices
      (async () => {
        const map: Record<string, { name: string; phone: string | null; email: string | null }> = {};
        const officeIds = Array.from(
          new Set(properties.map((p: { managing_office_id?: string }) => (p.managing_office_id ? String(p.managing_office_id) : "")).filter(Boolean))
        );
        if (officeIds.length > 0) {
          const rows = await ds.query(
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
            [officeIds]
          );
          for (const row of rows ?? []) {
            if (!row?.office_id) continue;
            map[String(row.office_id)] = {
              name: String(row.office_name ?? "—"),
              phone: row.office_phone ? String(row.office_phone) : null,
              email: row.office_email ? String(row.office_email) : null,
            };
          }
        }
        return map;
      })(),
    ]);

    const result = properties.map((p: any) => ({
      ...p,
      payment_frequency: frequencyToArabic(p.payment_frequency),
      active_contract: contractMap[p.id] ?? null,
      cover_url: coverMap[p.id] ?? null,
      owner_name: ownerMap[String(p.owner_id)]?.full_name ?? null,
      owner_phone: ownerMap[String(p.owner_id)]?.phone ?? null,
      managing_office_name: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.name ?? null : null,
      managing_office_phone: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.phone ?? null : null,
      managing_office_email: p.managing_office_id ? officeMap[String(p.managing_office_id)]?.email ?? null : null,
    }));

    const meta = (properties as { __pagination?: { total: number; page: number; limit: number; search?: string | null } }).__pagination;
    if (meta?.page && meta?.limit !== undefined) {
      return ok(paginated({ items: result, total: Number(meta.total) || 0, page: meta.page, limit: meta.limit, search: meta.search }));
    }
    return ok(result);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse({ error: err.message, code: err.code, ...(('details' in err && (err as any).details ? { details: (err as any).details } : {})) }, err.status);
    }
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
    console.log("[properties POST] user:", user?.userId, user?.userType, user?.officeId);
    if (!user) return unauthorized();
    const readOnly = denyIfOwnerCannotMutateProperties(user);
    if (readOnly) return readOnly;

    const body = await req.json();
    console.log("[properties POST] body keys:", Object.keys(body));
    const parsed = CreatePropertySchema.safeParse(body);
    if (!parsed.success) {
      console.error("[properties POST] zod error:", parsed.error.issues);
      return badRequest(badZod(parsed.error));
    }
    if (!parsed.data.name?.trim()) {
      console.error("[properties POST] missing name");
      return badRequest("اسم العقار مطلوب");
    }

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
      const agencyId = String(user.userId);

      const ownerIdRaw = typeof body.owner_id === "string" ? body.owner_id.trim() : "";
      let ownerId: string | null = null;

      if (ownerIdRaw && isUuid(ownerIdRaw)) {
        if (officeId) {
          const linked = await ds.query(
            "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
            [officeId, ownerIdRaw]
          );
          if (!Array.isArray(linked) || linked.length === 0) {
            log.error("[properties POST] owner not linked:", ownerIdRaw);
            return badRequest("المالك غير مرتبط بهذا المكتب");
          }
        } else {
          const owner = await ds
            .getRepository("User")
            .findOne({ where: { id: ownerIdRaw, created_by_agency_id: agencyId } });
          if (!owner) {
            log.error("[properties POST] owner not found:", ownerIdRaw, "agency:", agencyId);
            return badRequest("المالك غير موجود");
          }
        }
        ownerId = ownerIdRaw;
      }

      if (officeId && commissionPercentRaw === null) {
        log.error("[properties POST] commission required for office");
        return badRequest("نسبة العمولة مطلوبة");
      }

const requestedUnits =
        Number(body.apartments_count ?? 0) + Number(body.shops_count ?? 0) + Number(body.other_units_count ?? 0);
      // Plan unit-limit gate (auto-generated units included)
      const { countOfficeUnits, assertUnitLimit } = await import("@/lib/billing/enforce");
      if (officeId) {
        const current = await countOfficeUnits(officeId);
        await assertUnitLimit(officeId, current + requestedUnits);
      }

      const property = repo.create({
        owner_id: ownerId ?? agencyId,
        managing_office_id: officeId,
        created_by_agency_id: agencyId,
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
        payment_frequency: body.payment_frequency ? frequencyToEnglish(String(body.payment_frequency).trim()) : null,
        lessor_type: lessorType,
        lessor_contact_id: lessorContactId,
        commission_percent: commissionPercentRaw,
      });

      await repo.save(property);

      if (officeId) {
        const linkOwnerId = ownerId ?? agencyId;
        await ds.query(
          `
          INSERT INTO office_property_links (office_id, owner_id, property_id, commission_percent, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT DO NOTHING
          `,
          [officeId, linkOwnerId, String((property as { id?: string }).id), commissionPercentRaw]
        );
      }

      await generateUnits(ds, property, body);

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
      payment_frequency: body.payment_frequency ? frequencyToEnglish(String(body.payment_frequency).trim()) : null,
      lessor_type: lessorType,
      lessor_contact_id: lessorContactId,
      commission_percent: commissionPercentRaw,
    });

    await repo.save(property);

    // If owner assigned a managing office, create/update the link so the agency can access the property.
    const p = property as { managing_office_id?: string | null; commission_percent?: number | string | null; id?: string };
    const managingOfficeIdSaved = p.managing_office_id ? String(p.managing_office_id) : null;
    if (managingOfficeIdSaved) {
      const commission =
        p.commission_percent !== undefined && p.commission_percent !== null && p.commission_percent !== ""
          ? Number(p.commission_percent)
          : null;
      await ds.query(
        `
        INSERT INTO office_property_links (office_id, owner_id, property_id, commission_percent, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
        `,
        [managingOfficeIdSaved, ownerId, String(p.id), commission]
      );
    }

    await generateUnits(ds, property, body);

    return created(property);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse({ error: err.message, code: err.code, ...(('details' in err && (err as any).details ? { details: (err as any).details } : {})) }, err.status);
    }
    return serverError(err);
  }
}

async function generateUnits(ds: { getRepository: (name: string) => { create: (data: unknown) => unknown; save: (data: unknown[]) => Promise<unknown> } }, property: { id?: string; owner_id?: string }, body: { apartments_count?: number | string; shops_count?: number | string; other_units_count?: number | string }) {
  const propertyId = String(property.id);
  const ownerId = String(property.owner_id);
  const unitRepo = ds.getRepository("Unit");

  const apartmentsCount = Number(body.apartments_count ?? 0);
  const shopsCount = Number(body.shops_count ?? 0);
  const othersCount = Number(body.other_units_count ?? 0);

  if (apartmentsCount + shopsCount + othersCount === 0) return;

  const units: any[] = [];

  // Apartments
  for (let i = 1; i <= apartmentsCount; i++) {
    units.push(
      unitRepo.create({
        property_id: propertyId,
        owner_id: ownerId,
        label: `شقة ${i}`,
        unit_type: "apartment",
        status: "vacant",
      })
    );
  }

  // Shops
  for (let i = 1; i <= shopsCount; i++) {
    units.push(
      unitRepo.create({
        property_id: propertyId,
        owner_id: ownerId,
        label: `محل ${i}`,
        unit_type: "shop",
        status: "vacant",
      })
    );
  }

  // Other units
  for (let i = 1; i <= othersCount; i++) {
    units.push(
      unitRepo.create({
        property_id: propertyId,
        owner_id: ownerId,
        label: `وحدة ${i}`,
        unit_type: "other",
        status: "vacant",
      })
    );
  }

  if (units.length > 0) {
    await unitRepo.save(units);
  }
}
