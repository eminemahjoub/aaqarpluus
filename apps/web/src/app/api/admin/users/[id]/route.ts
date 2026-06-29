export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { badZod } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

const UpdateSchema = z.object({
  role: z.enum(["owner", "agency", "superadmin"]).optional(),
  is_active: z.boolean().optional(),
  reset_password: z.boolean().optional(),
  office_id: z.string().uuid().nullable().optional(),
});

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSuperAdmin(req);
    const { id } = await params;
    const ds = await getDataSource();
    const user = await ds.getRepository("User").findOne({ where: { id } as any });
    if (!user || (user as any).deleted_at) throw badRequest("المستخدم غير موجود");

    const ownerId = String((user as any).id);
    const [props, units, contracts] = await Promise.all([
      ds.query(`SELECT COUNT(*)::int AS c FROM properties WHERE deleted_at IS NULL AND owner_id = $1`, [ownerId]),
      ds.query(`SELECT COUNT(*)::int AS c FROM units WHERE deleted_at IS NULL AND owner_id = $1`, [ownerId]),
      ds.query(`SELECT COUNT(*)::int AS c FROM contracts WHERE deleted_at IS NULL AND owner_id = $1`, [ownerId]),
    ]);

    return ok({
      id: (user as any).id,
      full_name: (user as any).full_name ?? null,
      email: (user as any).email,
      phone: (user as any).phone ?? null,
      role: (user as any).user_type,
      is_active: Boolean((user as any).is_active),
      office_id: (user as any).office_id ?? null,
      created_at: (user as any).created_at ?? null,
      stats: {
        properties: Number(props?.[0]?.c) || 0,
        units: Number(units?.[0]?.c) || 0,
        contracts: Number(contracts?.[0]?.c) || 0,
      },
    });
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
    const repo = ds.getRepository("User");
    const user = await repo.findOne({ where: { id } as any });
    if (!user || (user as any).deleted_at) throw badRequest("المستخدم غير موجود");

    const changes: Record<string, { old: any; new: any }> = {};
    const patch: any = {};

    if (parsed.data.role !== undefined) {
      changes.role = { old: (user as any).user_type, new: parsed.data.role };
      patch.user_type = parsed.data.role;
    }
    if (parsed.data.is_active !== undefined) {
      changes.is_active = { old: Boolean((user as any).is_active), new: parsed.data.is_active };
      patch.is_active = parsed.data.is_active;
    }
    if (parsed.data.office_id !== undefined) {
      changes.office_id = { old: (user as any).office_id ?? null, new: parsed.data.office_id ?? null };
      patch.office_id = parsed.data.office_id ?? null;
    }

    let newPassword: string | null = null;
    if (parsed.data.reset_password) {
      newPassword = randomPassword();
      patch.password_hash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(patch).length) await repo.update(id, patch);

    logAudit({
      userId: (me as any).userId,
      action: "update",
      entityType: "user",
      entityId: id,
      changes: Object.keys(changes).length ? changes : undefined,
      metadata: parsed.data.reset_password ? { reset_password: true } : undefined,
      req,
    });

    return ok({ success: true, ...(newPassword ? { newPassword } : {}) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await assertSuperAdmin(req);
    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("User");
    const user = await repo.findOne({ where: { id } as any });
    if (!user || (user as any).deleted_at) throw badRequest("المستخدم غير موجود");

    await repo.update(id, { deleted_at: new Date().toISOString(), is_active: false } as any);

    logAudit({
      userId: (me as any).userId,
      action: "delete",
      entityType: "user",
      entityId: id,
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

