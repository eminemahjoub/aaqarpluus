import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { getAccessibleOwnerIds } from "@/lib/office-scope";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("ContractPayment");
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return unauthorized();

    // Verify ownership via contract join
    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin("contracts", "c", "c.id = cp.contract_id AND c.owner_id IN (:...ownerIds)", { ownerIds })
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
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return unauthorized();

    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin("contracts", "c", "c.id = cp.contract_id AND c.owner_id IN (:...ownerIds)", { ownerIds })
      .where("cp.id = :id", { id })
      .getOne();

    if (!payment) return unauthorized();

    await ds.getRepository("ContractPayment").delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
