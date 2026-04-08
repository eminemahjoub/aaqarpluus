import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();

    const property = await ds
      .getRepository("Property")
      .findOne({ where: { id, owner_id: user.userId } as any });

    if (!property) return unauthorized();

    // Load units for this property
    const units = await ds
      .getRepository("Unit")
      .createQueryBuilder("u")
      .where("u.property_id = :id", { id })
      .orderBy("u.created_at", "ASC")
      .getMany();

    // Load contracts with joins
    const contracts = await ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.unit", "unit")
      .where("c.property_id = :id", { id })
      .andWhere("c.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("c.start_date", "DESC")
      .getMany();

    // Load contract payments
    const contractIds = contracts.map((c: any) => c.id).filter(Boolean);
    let payments: any[] = [];
    if (contractIds.length > 0) {
      payments = await ds
        .getRepository("ContractPayment")
        .createQueryBuilder("cp")
        .where("cp.contract_id IN (:...contractIds)", { contractIds })
        .orderBy("cp.due_date", "ASC")
        .getMany();
    }

    // Load revenues and expenses
    const revenues = await ds
      .getRepository("Revenue")
      .createQueryBuilder("r")
      .where("r.property_id = :id", { id })
      .andWhere("r.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("r.created_at", "DESC")
      .getMany();

    const expenses = await ds
      .getRepository("Expense")
      .createQueryBuilder("e")
      .where("e.property_id = :id", { id })
      .andWhere("e.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("e.created_at", "DESC")
      .getMany();

    return ok({ ...(property as any), units, contracts, payments, revenues, expenses });
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
    const repo = ds.getRepository("Property");

    const property = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!property) return unauthorized();

    const updates: Record<string, any> = {};
    const fields = ["name", "title", "status", "property_model_type", "region", "city", "neighborhood", "address", "area_m2", "property_cost", "units_count", "description"];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
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

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Property");

    const property = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!property) return unauthorized();

    // Delete in proper order using raw SQL to avoid FK violations
    await ds.query(`DELETE FROM contract_payments WHERE contract_id IN (SELECT id FROM contracts WHERE property_id = $1)`, [id]);
    await ds.query(`DELETE FROM contracts WHERE property_id = $1`, [id]);
    await ds.query(`DELETE FROM revenues WHERE property_id = $1`, [id]);
    await ds.query(`DELETE FROM expenses WHERE property_id = $1`, [id]);
    await ds.query(`UPDATE tasks SET property_id = NULL WHERE property_id = $1`, [id]);
    await ds.query(`UPDATE documents SET property_id = NULL WHERE property_id = $1`, [id]);
    await ds.query(`DELETE FROM property_images WHERE property_id = $1`, [id]);
    await ds.query(`DELETE FROM units WHERE property_id = $1`, [id]);
    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
