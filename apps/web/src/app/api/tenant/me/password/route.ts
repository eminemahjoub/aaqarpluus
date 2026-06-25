import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, unauthorized, serverError, badRequest } from "@/lib/api-helpers";
import { getTenantFromRequest } from "@/lib/tenant-api-helpers";
import { badZod } from "@/lib/validation";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().trim().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword: z.string().trim().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"),
});

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) return unauthorized();

    const raw = await req.json();
    const parsed = ChangePasswordSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const contact = await ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where("c.id = :id", { id: tenant.tenantId })
      .andWhere("c.deleted_at IS NULL")
      .getOne();

    if (!contact) return unauthorized();

    const c = contact as { pin_hash?: string };
    if (!c.pin_hash) return badRequest("لم يتم تفعيل الدخول لهذا الحساب بعد");

    const valid = await bcrypt.compare(parsed.data.currentPassword, c.pin_hash);
    if (!valid) return badRequest("كلمة المرور الحالية غير صحيحة");

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await ds.getRepository("Contact").update(tenant.tenantId, { pin_hash: newHash } as any);

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
