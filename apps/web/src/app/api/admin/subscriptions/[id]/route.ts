import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { badZod } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

const UpdateSchema = z.object({
  plan: z.enum(["free", "basic", "premium", "enterprise"]).optional(),
  status: z.enum(["active", "expired", "cancelled", "trial"]).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  max_properties: z.number().int().min(0).optional(),
  max_units: z.number().int().min(0).optional(),
  max_users: z.number().int().min(0).optional(),
  price: z.number().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await assertSuperAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));
    const ds = await getDataSource();
    const repo = ds.getRepository("Subscription");
    const sub = await repo.findOne({ where: { id } as any });
    if (!sub) throw badRequest("الاشتراك غير موجود");

    const changes: Record<string, { old: any; new: any }> = {};
    const patch: any = {};
    for (const k of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
      const v = (parsed.data as any)[k];
      if (v === undefined) continue;
      patch[k] = v;
      changes[k] = { old: (sub as any)[k], new: v };
    }
    if (Object.keys(patch).length) await repo.update(id, patch);

    logAudit({
      userId: (me as any).userId,
      action: "update",
      entityType: "subscription",
      entityId: id,
      changes: Object.keys(changes).length ? changes : undefined,
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await assertSuperAdmin(req);
    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Subscription");
    const sub = await repo.findOne({ where: { id } as any });
    if (!sub) throw badRequest("الاشتراك غير موجود");

    await repo.update(id, { status: "cancelled", end_date: (sub as any).end_date ?? new Date().toISOString().slice(0, 10) } as any);

    logAudit({
      userId: (me as any).userId,
      action: "delete",
      entityType: "subscription",
      entityId: id,
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

