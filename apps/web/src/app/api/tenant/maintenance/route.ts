import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created, badRequest, unauthorized, serverError } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";

const CreateMaintenanceSchema = z.object({
  title: z.string().trim().min(1, "عنوان الطلب مطلوب"),
  description: z.string().trim().min(1, "وصف المشكلة مطلوب"),
  priority: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) return unauthorized();

    const ds = await getDataSource();
    const tasks = await ds
      .getRepository("Task")
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.property", "property")
      .leftJoinAndSelect("t.unit", "unit")
      .where("t.tenant_id = :tenantId", { tenantId: tenant.tenantId })
      .andWhere("t.type = :type", { type: "maintenance" })
      .andWhere("t.deleted_at IS NULL")
      .orderBy("t.created_at", "DESC")
      .getMany();

    return ok(tasks);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) return unauthorized();

    const raw = await req.json();
    const parsed = CreateMaintenanceSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const contact = await ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.id = :id", { id: tenant.tenantId })
      .andWhere("c.deleted_at IS NULL")
      .getOne();

    if (!contact) return unauthorized();

    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("ct")
      .where("ct.contact_id = :contactId", { contactId: tenant.tenantId })
      .andWhere("ct.status = :status", { status: "active" })
      .andWhere("ct.deleted_at IS NULL")
      .orderBy("ct.created_at", "DESC")
      .getOne();

    if (!contract) return badRequest("لا يوجد عقد ساري لإنشاء طلب صيانة");

    const c = contract as { owner_id?: string; property_id?: string; unit_id?: string };
    const repo = ds.getRepository("Task");
    const task = repo.create({
      owner_id: String(c.owner_id),
      tenant_id: tenant.tenantId,
      property_id: c.property_id ? String(c.property_id) : null,
      unit_id: c.unit_id ? String(c.unit_id) : null,
      contact_id: tenant.tenantId,
      type: "maintenance",
      title: parsed.data.title,
      description: parsed.data.description,
      status: "pending",
      priority: parsed.data.priority ?? "medium",
      cost_sar: 0,
    });

    await repo.save(task);

    const property = await ds
      .getRepository("Property")
      .createQueryBuilder("p")
      .where("p.id = :id", { id: c.property_id })
      .getOne();
    const p = property as { managing_office_id?: string; created_by_agency_id?: string };
    const agencyUserIds: string[] = [];
    if (p?.managing_office_id) {
      const members = await ds.query(
        `SELECT id FROM users WHERE user_type = 'agency' AND office_id = $1 AND deleted_at IS NULL`,
        [String(p.managing_office_id)]
      );
      for (const m of members ?? []) {
        if (m.id) agencyUserIds.push(String(m.id));
      }
    }
    if (agencyUserIds.length === 0 && p?.created_by_agency_id) {
      agencyUserIds.push(String(p.created_by_agency_id));
    }
    if (agencyUserIds.length === 0 && c.owner_id) {
      agencyUserIds.push(String(c.owner_id));
    }

    const notifRepo = ds.getRepository("Notification");
    for (const userId of agencyUserIds) {
      await notifRepo.save(
        notifRepo.create({
          user_id: userId,
          type: "maintenance",
          title: "طلب صيانة جديد",
          body: `${tenant.name}: ${parsed.data.title}`,
          reference_id: String((task as { id?: string }).id),
          reference_type: "task",
          is_read: false,
        })
      );
    }

    return created(task);
  } catch (err) {
    return serverError(err);
  }
}
