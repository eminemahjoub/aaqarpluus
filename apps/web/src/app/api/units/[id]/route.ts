import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { denyIfOwnerCannotMutateProperties } from "@/lib/mutate-guard";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const readOnly = denyIfOwnerCannotMutateProperties(user);
    if (readOnly) return readOnly;

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Unit");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const unit = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!unit) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((unit as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    }

    const updates: Record<string, any> = {};
    const fields = ["label", "unit_type", "floor", "area_sqm", "rent_amount", "status", "description"];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    // Accept area_m2 as alias for area_sqm
    if (body.area_m2 !== undefined && body.area_sqm === undefined) {
      updates.area_sqm = body.area_m2;
    }

    await repo.update(id, updates);
    const updated = await repo.findOne({ where: { id } as any });
    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    const readOnly = denyIfOwnerCannotMutateProperties(user);
    if (readOnly) return readOnly;

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Unit");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const unit = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!unit) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((unit as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    }

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
