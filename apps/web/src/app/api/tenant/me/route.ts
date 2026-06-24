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

    const c = contact as { id?: string; name?: string; phone?: string };
    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("ct")
      .leftJoinAndSelect("ct.property", "property")
      .leftJoinAndSelect("ct.unit", "unit")
      .where("ct.contact_id = :contactId", { contactId: c.id })
      .andWhere("ct.deleted_at IS NULL")
      .orderBy("ct.created_at", "DESC")
      .getOne();

    const contractData = contract as {
      id?: string;
      property_id?: string;
      property?: { name?: string };
      unit_id?: string;
      unit?: { label?: string };
      start_date?: string;
      end_date?: string;
      rent_total_sar?: number;
      status?: string;
    };

    return ok({
      tenant: {
        id: String(c.id),
        name: String(c.name),
        phone: String(c.phone),
      },
      contract: contract
        ? {
            id: String(contractData.id),
            propertyId: String(contractData.property_id),
            propertyName: String(contractData.property?.name ?? "—"),
            unitId: contractData.unit_id ? String(contractData.unit_id) : null,
            unitLabel: String(contractData.unit?.label ?? "—"),
            startDate: String(contractData.start_date ?? "—"),
            endDate: String(contractData.end_date ?? "—"),
            rentTotalSar: Number(contractData.rent_total_sar) || 0,
            status: String(contractData.status ?? "—"),
          }
        : null,
    });
  } catch (err) {
    return serverError(err);
  }
}
