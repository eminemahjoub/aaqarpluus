import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, unauthorized, serverError } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) return unauthorized();

    const ds = await getDataSource();
    const contact = await ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.id = :id", { id: tenant.tenantId })
      .andWhere("c.deleted_at IS NULL")
      .getOne();

    if (!contact) return unauthorized();

    const c = contact as any;
    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("ct")
      .leftJoinAndSelect("ct.property", "property")
      .leftJoinAndSelect("ct.unit", "unit")
      .where("ct.contact_id = :contactId", { contactId: c.id })
      .andWhere("ct.deleted_at IS NULL")
      .orderBy("ct.created_at", "DESC")
      .getOne();

    return ok({
      tenant: {
        id: String(c.id),
        name: String(c.name),
        phone: String(c.phone),
      },
      contract: contract
        ? {
            id: String((contract as any).id),
            propertyId: String((contract as any).property_id),
            propertyName: String((contract as any).property?.name ?? "—"),
            unitId: (contract as any).unit_id ? String((contract as any).unit_id) : null,
            unitLabel: String((contract as any).unit?.label ?? "—"),
            startDate: String((contract as any).start_date ?? "—"),
            endDate: String((contract as any).end_date ?? "—"),
            rentTotalSar: Number((contract as any).rent_total_sar) || 0,
            status: String((contract as any).status ?? "—"),
          }
        : null,
    });
  } catch (err) {
    return serverError(err);
  }
}
