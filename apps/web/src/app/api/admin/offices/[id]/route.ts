export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { badZod } from "@/lib/validation";

const UpdateSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  address: z.string().optional().nullable(),
  license: z.string().trim().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSuperAdmin(req);
    const { id } = await params;
    const ds = await getDataSource();

    const office = await ds.query(`SELECT * FROM offices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]);
    const o = office?.[0];
    if (!o) throw badRequest("المكتب غير موجود");

    const owners = await ds.query(
      `
      SELECT l.id AS link_id, u.id AS owner_id, u.full_name, u.email, u.phone, l.created_at
      FROM office_owner_links l
      JOIN users u ON u.id = l.owner_id
      WHERE l.office_id = $1 AND u.deleted_at IS NULL
      ORDER BY l.created_at DESC
      `,
      [id]
    );

    const properties = await ds.query(
      `
      SELECT opl.id, opl.owner_id, opl.property_id, opl.commission_percent, p.name AS property_name
      FROM office_property_links opl
      LEFT JOIN properties p ON p.id = opl.property_id
      WHERE opl.office_id = $1
      ORDER BY opl.created_at DESC
      `,
      [id]
    );

    return ok({ office: o, owners: owners ?? [], properties: properties ?? [] });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await assertSuperAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));
    const ds = await getDataSource();

    const before = await ds.query(`SELECT * FROM offices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]);
    const o = before?.[0];
    if (!o) throw badRequest("المكتب غير موجود");

    const patch: any = {};
    const changes: Record<string, { old: any; new: any }> = {};
    for (const k of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
      const next = (parsed.data as any)[k];
      if (next === undefined) continue;
      patch[k] = next;
      changes[k] = { old: (o as any)[k], new: next };
    }
    if (Object.keys(patch).length === 0) return ok({ success: true });

    const sets = Object.keys(patch).map((k, i) => `${k} = $${i + 1}`).join(", ");
    const vals = Object.keys(patch).map((k) => patch[k]);
    vals.push(id);
    await ds.query(`UPDATE offices SET ${sets}, updated_at = NOW() WHERE id = $${vals.length}`, vals);

    logAudit({
      userId: (me as any).userId,
      action: "update",
      entityType: "office",
      entityId: id,
      changes,
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

