import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null;
  const agencyId = String(user.userId);
  const rows = await ds.query(
    `SELECT id FROM properties
     WHERE deleted_at IS NULL
       AND (created_by_agency_id = $1 OR owner_id = $1 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = owner_id
           AND u.created_by_agency_id = $1
           AND u.deleted_at IS NULL
       ))`,
    [agencyId]
  );
  const ids: string[] = Array.from(new Set((rows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
  return ids.length > 0 ? ids : [];
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("ContractPayment");
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // Verify ownership via contract join
    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "contracts",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .where("cp.id = :id", { id })
      .getOne();

    if (!payment) return unauthorized();

    const updates: Record<string, any> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.paid_at !== undefined) updates.paid_at = body.paid_at;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.amount_sar !== undefined) updates.amount_sar = Number(body.amount_sar);

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

    const { id } = await params;
    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "contracts",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .where("cp.id = :id", { id })
      .getOne();

    if (!payment) return unauthorized();

    await ds.getRepository("ContractPayment").delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
