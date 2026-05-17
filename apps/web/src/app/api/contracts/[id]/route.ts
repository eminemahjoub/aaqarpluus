import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.unit", "unit")
      .leftJoinAndSelect("c.property", "property")
      .where("c.id = :id", { id })
      .getOne();

    if (!contract) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((contract as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    } else if (String((contract as any).owner_id) !== String(user.userId)) {
      return unauthorized();
    }
    return ok(contract);
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const contract = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!contract) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((contract as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    }

    const updates: Record<string, any> = {};
    const fields = [
      "status",
      "start_date",
      "end_date",
      "unit_id",
      "contact_id",
      "extra",
      "rent_total_sar",
      "rent_amount_sar",
      "notes",
      "payment_frequency",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    await repo.update(id, updates);
    const updated = await repo.findOne({ where: { id } as any });

    // Sync property status when contract status changes
    if (body.status && (contract as any).property_id) {
      const propId = (contract as any).property_id;
      if (body.status === "active") {
        await ds.getRepository("Property").update(propId, { status: "active" } as any);
      } else if (body.status === "cancelled" || body.status === "expired" || body.status === "ended") {
        // Check if any other active contract exists for this property
        const otherActive = await ds.getRepository("Contract").createQueryBuilder("c")
          .where("c.property_id = :propId", { propId })
          .andWhere("c.id != :id", { id })
          .andWhere("c.status = :status", { status: "active" })
          .getCount();
        if (otherActive === 0) {
          await ds.getRepository("Property").update(propId, { status: "vacant" } as any);
        }
      }
    }

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Contract");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const contract = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!contract) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((contract as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    }

    // Delete associated payments first
    await ds.getRepository("ContractPayment").delete({ contract_id: id } as any);

    // Free up the unit
    if ((contract as any).unit_id) {
      await ds.getRepository("Unit").update((contract as any).unit_id, { status: "vacant" } as any);
    }

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
