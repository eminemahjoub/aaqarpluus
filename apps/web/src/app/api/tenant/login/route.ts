export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { signTenantToken, serializeTenantCookie } from "@/lib/tenant-auth";
import { z } from "zod";
import { badZod } from "@/lib/validation";

const LoginSchema = z.object({
  phone: z.string().trim().min(1, "رقم الجوال مطلوب"),
  pin: z.string().trim().min(1, "رمز الدخول مطلوب"),
});

function normalizePhone(s: string): string | null {
  const p = s.replace(/[\s\-]/g, "");
  if (/^05\d{8}$/.test(p)) return `+966${p.substring(1)}`;
  if (/^\+9665\d{8}$/.test(p)) return p;
  if (/^5\d{8}$/.test(p)) return `+966${p}`;
  if (/^9665\d{8}$/.test(p)) return `+${p}`;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = LoginSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return badRequest("صيغة رقم الجوال غير صحيحة");
    const localPhone = phone.startsWith("+966") ? "0" + phone.slice(4) : phone;
    const mobileOnly = phone.startsWith("+966") ? phone.slice(4) : localPhone.startsWith("0") ? localPhone.slice(1) : localPhone;
    const phones = [phone, localPhone, mobileOnly, "966" + mobileOnly];

    const ds = await getDataSource();
    const contact = await ds
      .getRepository("Contact")
      .createQueryBuilder("c")
      .where(
        "c.phone IN (:...phones) OR c.alternative_phone IN (:...phones)",
        { phones }
      )
      .andWhere("c.deleted_at IS NULL")
      .getOne();

    if (!contact) return badRequest("لا يوجد مستأجر مرتبط بهذا الرقم.");

    const c = contact as { pin_hash?: string; id?: string; name?: string; owner_id?: string; phone?: string };
    if (!c.pin_hash) return badRequest("لم يتم تفعيل الدخول لهذا الحساب بعد. أنشئ رمز دخول من صفحة المستأجرين.");

    const valid = await bcrypt.compare(parsed.data.pin, c.pin_hash);
    if (!valid) return badRequest("رمز الدخول غير صحيح.");

    // Verify active contract
    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("ct")
      .where("ct.contact_id = :contactId", { contactId: c.id })
      .andWhere("ct.status = :status", { status: "active" })
      .andWhere("ct.deleted_at IS NULL")
      .orderBy("ct.created_at", "DESC")
      .getOne();

    if (!contract) return badRequest("لا يوجد عقد ساري مرتبط بهذا الرقم");

    const token = await signTenantToken({
      tenantId: String(c.id),
      email: String(c.phone),
      name: String(c.name),
      userType: "tenant",
    });

    const response = ok({
      tenant: {
        id: String(c.id),
        name: String(c.name),
        phone: String(c.phone),
      },
    });
    response.headers.append("Set-Cookie", serializeTenantCookie(token, 7 * 24 * 3600));
    return response;
  } catch (err) {
    return serverError(err);
  }
}
