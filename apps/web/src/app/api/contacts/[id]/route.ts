import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { getAccessiblePropertyIds } from "@/lib/office-scope";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("Contact");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let contact: any = null;
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return unauthorized();
      const rows = await ds.query(
        `SELECT c.id FROM contacts c
         JOIN contracts ct ON ct.contact_id = c.id
         WHERE c.id = $1 AND ct.property_id = ANY($2) AND c.deleted_at IS NULL
         LIMIT 1`,
        [id, propertyIds]
      );
      if (!rows?.length) return unauthorized();
      contact = await repo.findOne({ where: { id } as any });
    } else {
      contact = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    }
    if (!contact) return unauthorized();

    await repo.update(id, {
      name: body.name ?? (contact as any).name,
      phone: body.phone !== undefined ? body.phone : (contact as any).phone,
      alternative_phone: body.alternative_phone !== undefined ? body.alternative_phone : (contact as any).alternative_phone,
      type: body.type ?? (contact as any).type,
      status: body.status ?? (contact as any).status,
    } as any);

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
    const repo = ds.getRepository("Contact");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    let contact: any = null;
    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return unauthorized();
      const rows = await ds.query(
        `SELECT c.id FROM contacts c
         JOIN contracts ct ON ct.contact_id = c.id
         WHERE c.id = $1 AND ct.property_id = ANY($2) AND c.deleted_at IS NULL
         LIMIT 1`,
        [id, propertyIds]
      );
      if (!rows?.length) return unauthorized();
      contact = await repo.findOne({ where: { id } as any });
    } else {
      contact = await repo.findOne({ where: { id, owner_id: user.userId } as any });
    }
    if (!contact) return unauthorized();

    // Nullify contact references before deleting (avoid FK violations)
    await ds.query(`UPDATE contracts SET contact_id = NULL WHERE contact_id = $1`, [id]);
    await ds.query(`UPDATE tasks SET contact_id = NULL WHERE contact_id = $1`, [id]);

    await repo.update(id, { deleted_at: new Date().toISOString() } as any);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
