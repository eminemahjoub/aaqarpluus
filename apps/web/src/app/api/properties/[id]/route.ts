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
    const property = Array.isArray(propertyIds)
      ? await ds.getRepository("Property").findOne({ where: { id } as any })
      : await ds.getRepository("Property").findOne({ where: { id, owner_id: user.userId } as any });

    if (!property) return unauthorized();
    if (Array.isArray(propertyIds) && !(await assertAgencyCanAccessProperty(ds, user, id))) return unauthorized();

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
      .orderBy("r.created_at", "DESC")
      .getMany();

    const expenses = await ds
      .getRepository("Expense")
      .createQueryBuilder("e")
      .where("e.property_id = :id", { id })
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

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const property = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!property) return unauthorized();
    if (Array.isArray(propertyIds) && !(await assertAgencyCanAccessProperty(ds, user, id))) return unauthorized();

    const updates: Record<string, any> = {};
    const fields = [
      "name",
      "title",
      "status",
      "property_model_type",
      "region",
      "city",
      "neighborhood",
      "address",
      "latitude",
      "longitude",
      "area_m2",
      "property_cost",
      "units_count",
      "apartments_count",
      "shops_count",
      "other_units_count",
      "unit_identifiers",
      "title_deed_number",
      "water_account",
      "electricity_account",
      "description",
      "payment_frequency",
      "lessor_type",
      "lessor_contact_id",
      "managing_office_id",
      "commission_percent",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    await repo.update(id, updates);

    // Sync office_property_links when owner changes managing office or commission.
    if (String(user.userType ?? "") !== "agency") {
      const nextManagingOfficeId =
        updates.managing_office_id !== undefined
          ? (updates.managing_office_id ? String(updates.managing_office_id) : null)
          : ((property as any).managing_office_id ? String((property as any).managing_office_id) : null);

      const nextCommission =
        updates.commission_percent !== undefined
          ? (updates.commission_percent !== null && updates.commission_percent !== "" ? Number(updates.commission_percent) : null)
          : ((property as any).commission_percent !== null && (property as any).commission_percent !== undefined ? Number((property as any).commission_percent) : null);

      const ownerId = String((property as any).owner_id);

      if (!nextManagingOfficeId) {
        await ds.query(`DELETE FROM office_property_links WHERE owner_id = $1 AND property_id = $2`, [ownerId, id]);
      } else {
        // Ensure a link exists and keep commission in sync.
        await ds.query(
          `
          INSERT INTO office_property_links (office_id, owner_id, property_id, commission_percent, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT DO NOTHING
          `,
          [nextManagingOfficeId, ownerId, id, nextCommission]
        );
        await ds.query(
          `UPDATE office_property_links SET commission_percent = $1 WHERE owner_id = $2 AND property_id = $3 AND office_id = $4`,
          [nextCommission, ownerId, id, nextManagingOfficeId]
        );
      }
    }

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

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const property = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!property) return unauthorized();
    if (Array.isArray(propertyIds) && !(await assertAgencyCanAccessProperty(ds, user, id))) return unauthorized();

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
