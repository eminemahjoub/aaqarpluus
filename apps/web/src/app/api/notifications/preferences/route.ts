export const dynamic = "force-dynamic";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { badRequest } from "@/lib/errors";
import {
  withAuth,
  resolveContext,
  type UserContext,
} from "@/lib/auth/scope";

const DEFAULTS = {
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  quiet_hours: { start: "22:00", end: "08:00" },
};

const QuietHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM"),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM"),
});

const PrefsUpdateSchema = z
  .object({
    email_enabled: z.boolean().optional(),
    sms_enabled: z.boolean().optional(),
    whatsapp_enabled: z.boolean().optional(),
    quiet_hours: QuietHoursSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "لا توجد حقلات للتحديث" });

export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx) => {
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT email_enabled, sms_enabled, whatsapp_enabled, quiet_hours
         FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [ctx.userId]
    );
    const row = rows?.[0];
    return ok(
      row
        ? {
            email_enabled: Boolean(row.email_enabled),
            sms_enabled: Boolean(row.sms_enabled),
            whatsapp_enabled: Boolean(row.whatsapp_enabled),
            quiet_hours: row.quiet_hours ?? DEFAULTS.quiet_hours,
          }
        : DEFAULTS
    );
  }
);

export const PUT = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw badRequest("البيانات مطلوبة");
    const parsed = PrefsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues?.[0]?.message ?? "بيانات غير صحيحة");
    }
    const data = parsed.data;

    const ds = await getDataSource();
    const existing = await ds.query(
      `SELECT user_id FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [ctx.userId]
    );

    if (!existing?.[0]) {
      await ds.query(
        `INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, whatsapp_enabled, quiet_hours, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          ctx.userId,
          data.email_enabled ?? DEFAULTS.email_enabled,
          data.sms_enabled ?? DEFAULTS.sms_enabled,
          data.whatsapp_enabled ?? DEFAULTS.whatsapp_enabled,
          JSON.stringify(data.quiet_hours ?? DEFAULTS.quiet_hours),
        ]
      );
    } else {
      const sets: string[] = [];
      const params: unknown[] = [ctx.userId];
      for (const [col, val] of Object.entries(data)) {
        if (col === "quiet_hours") continue;
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      }
      if (data.quiet_hours) {
        params.push(JSON.stringify(data.quiet_hours));
        sets.push(`quiet_hours = $${params.length}`);
      }
      if (sets.length > 0) {
        params.push(new Date().toISOString());
        sets.push("updated_at = $" + params.length);
        await ds.query(`UPDATE notification_preferences SET ${sets.join(", ")} WHERE user_id = $1`, params);
      }
    }

    const after = await ds.query(
      `SELECT email_enabled, sms_enabled, whatsapp_enabled, quiet_hours
         FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [ctx.userId]
    );
    const row = after?.[0];
    return ok({
      email_enabled: Boolean(row.email_enabled),
      sms_enabled: Boolean(row.sms_enabled),
      whatsapp_enabled: Boolean(row.whatsapp_enabled),
      quiet_hours: row.quiet_hours ?? DEFAULTS.quiet_hours,
    });
  }
);