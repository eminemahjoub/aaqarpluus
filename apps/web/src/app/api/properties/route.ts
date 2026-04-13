import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { getAccessibleOwnerIds, assertAgencyCanAccessOwner } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const ds = await getDataSource();

    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return ok([]);

    const properties = await ds
      .getRepository("Property")
      .createQueryBuilder("p")
      .where("p.owner_id IN (:...ownerIds)", { ownerIds })
      .orderBy("p.created_at", "DESC")
      .getMany();

    // Attach active contract info per property
    const propIds = properties.map((p: any) => p.id).filter(Boolean);
    const today = new Date().toISOString().split("T")[0];

    let contractMap: Record<string, any> = {};
    if (propIds.length > 0) {
      const contracts = await ds
        .getRepository("Contract")
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.contact", "contact")
        .leftJoinAndSelect("c.unit", "unit")
        .where("c.property_id IN (:...propIds)", { propIds })
        .andWhere("c.status = :status", { status: "active" })
        .andWhere("c.owner_id IN (:...ownerIds)", { ownerIds })
        .andWhere("c.start_date <= :today", { today })
        .andWhere("c.end_date >= :today", { today })
        .orderBy("c.start_date", "DESC")
        .getMany();

      for (const c of contracts) {
        const pid = (c as any).property_id;
        if (!pid || contractMap[pid]) continue;
        contractMap[pid] = {
          contact_name: (c as any).contact?.name ?? "—",
          contact_phone: (c as any).contact?.phone ?? null,
          unit_label: (c as any).unit?.label ?? "—",
          start_date: (c as any).start_date ?? "—",
          end_date: (c as any).end_date ?? "—",
        };
      }
    }

    // Fetch cover image per property for thumbnail (prefer image_type='cover', fallback to first)
    let coverMap: Record<string, string> = {};
    if (propIds.length > 0) {
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

    const result = properties.map((p: any) => ({
      ...p,
      active_contract: contractMap[p.id] ?? null,
      cover_url: coverMap[p.id] ?? null,
    }));

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const body = await req.json();
    if (!body.name?.trim()) return badRequest("اسم العقار مطلوب");

    const ds = await getDataSource();
    const repo = ds.getRepository("Property");
    const ownerId = String(body.owner_id ?? user.userId);
    const can = await assertAgencyCanAccessOwner(ds, user, ownerId);
    if (!can) return unauthorized();

    const property = repo.create({
      owner_id: ownerId,
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
      lessor_type: body.lessor_type === "office" || body.lessor_type === "owner" ? body.lessor_type : null,
      lessor_contact_id: body.lessor_type === "office" && body.lessor_contact_id ? body.lessor_contact_id : null,
      commission_percent:
        body.commission_percent !== undefined && body.commission_percent !== null && body.commission_percent !== ""
          ? Number(body.commission_percent)
          : null,
    } as any);

    await repo.save(property);
    return created(property);
  } catch (err) {
    return serverError(err);
  }
}
