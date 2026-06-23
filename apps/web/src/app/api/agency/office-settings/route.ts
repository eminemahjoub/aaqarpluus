import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();

    const ds = await getDataSource();
    const officeId = String(user.officeId ?? "");
    if (!officeId) return badRequest("لا يوجد مكتب مرتبط بحسابك");

    const rows = await ds.query(
      `SELECT id, name, phone, email, address, license, cr_number, vat_number, logo_url, description_ar, description_en
       FROM offices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [officeId]
    );

    if (!rows || rows.length === 0) return badRequest("المكتب غير موجود");

    return ok(rows[0]);
  } catch (err) {
    console.error("[office-settings GET] error:", err);
    return serverError(err);
  }
}

const UpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  address: z.string().optional().nullable(),
  license: z.string().trim().optional().nullable(),
  cr_number: z.string().trim().optional().nullable(),
  vat_number: z.string().trim().optional().nullable(),
  logo_url: z.string().trim().optional().nullable(),
  description_ar: z.string().trim().optional().nullable(),
  description_en: z.string().trim().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();

    const ds = await getDataSource();
    const officeId = String(user.officeId ?? "");
    if (!officeId) return badRequest("لا يوجد مكتب مرتبط بحسابك");

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return ok({ success: true });

    const sets = Object.keys(patch).map((k, i) => `${k} = $${i + 1}`).join(", ");
    const vals = Object.values(patch);
    vals.push(officeId);
    await ds.query(`UPDATE offices SET ${sets}, updated_at = NOW() WHERE id = $${vals.length}`, vals);

    return ok({ success: true });
  } catch (err) {
    console.error("[office-settings PUT] error:", err);
    return serverError(err);
  }
}
