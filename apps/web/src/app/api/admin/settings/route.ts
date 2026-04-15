import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { badZod } from "@/lib/validation";

const PutSchema = z.object({
  key: z.string().trim().min(1),
  value: z.any(),
});

export async function GET(req: NextRequest) {
  try {
    await assertSuperAdmin(req);
    const ds = await getDataSource();
    const rows = await ds.query(`SELECT key, value, updated_by, updated_at FROM platform_settings ORDER BY key ASC`);
    return ok(rows ?? []);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await assertSuperAdmin(req);
    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    await ds.query(
      `
      INSERT INTO platform_settings (key, value, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `,
      [parsed.data.key, parsed.data.value, String((me as any).email ?? (me as any).userId)]
    );

    logAudit({
      userId: (me as any).userId,
      action: "update",
      entityType: "platform_setting",
      entityId: parsed.data.key,
      metadata: { key: parsed.data.key },
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

