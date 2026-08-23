export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signAccessToken, signRefreshToken, TOKEN_COOKIE, REFRESH_COOKIE, serializeAuthCookie, generateCsrfToken, serializeCsrfCookie } from "@/lib/auth";
import { signTenantToken, serializeTenantCookie } from "@/lib/tenant-auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordLoginAttempt, clientIp, clientUserAgent } from "@/lib/login-audit";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "البريد الإلكتروني/رقم الجوال مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`login:${ip}`, 10, 300))) return badRequest("محاولات كثيرة، حاول لاحقاً");
    const auditIp = clientIp(req);
    const auditUa = clientUserAgent(req);

    const body = await req.json();
    const parsed = LoginSchema.safeParse({
      identifier: body.identifier ?? body.email ?? "",
      password: body.password ?? "",
    });
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const rawIdentifier = parsed.data.identifier;
    const password = parsed.data.password;

    const normalizePhone = (s: string) => {
      const p = s.replace(/[\s\-]/g, "");
      if (/^05\d{8}$/.test(p)) return `+966${p.substring(1)}`;
      if (/^\+9665\d{8}$/.test(p)) return p;
      if (/^5\d{8}$/.test(p)) return `+966${p}`;
      if (/^9665\d{8}$/.test(p)) return `+${p}`;
      return null;
    };

    const identifier = rawIdentifier.toLowerCase();
    const phone = normalizePhone(rawIdentifier);
    const isEmail = identifier.includes("@");

    const ds = await getDataSource();
    const qb = ds.getRepository("User").createQueryBuilder("u");
    if (phone) {
      qb.where("u.phone = :phone", { phone });
    } else if (isEmail) {
      qb.where("u.email = :email", { email: identifier });
    } else {
      // If it's not a recognized phone format, fall back to email match.
      qb.where("u.email = :email", { email: identifier });
    }
    const user = await qb.getOne();

    if (!user) {
      // Try tenant/renter login fallback when identifier is a phone number.
      const tenantPhone = normalizePhone(rawIdentifier);
      if (tenantPhone) {
        const localPhone = tenantPhone.startsWith("+966") ? "0" + tenantPhone.slice(4) : tenantPhone;
        const mobileOnly = tenantPhone.startsWith("+966") ? tenantPhone.slice(4) : localPhone.startsWith("0") ? localPhone.slice(1) : localPhone;
        const phones = [tenantPhone, localPhone, mobileOnly, "966" + mobileOnly];
        const contact = await ds
          .getRepository("Contact")
          .createQueryBuilder("c")
          .where(
            "c.phone IN (:...phones) OR c.alternative_phone IN (:...phones)",
            { phones }
          )
          .andWhere("c.deleted_at IS NULL")
          .getOne();
        if (contact) {
          const c = contact as { pin_hash?: string; id?: string; name?: string; phone?: string };
          if (!c.pin_hash) {
            await recordLoginAttempt({ userId: null, email: String(c.phone), ip: auditIp, userAgent: auditUa, success: false, failureReason: "pin_not_set" });
            return badRequest("لم يتم تفعيل الدخول لهذا المستأجر بعد. أنشئ رمز دخول من صفحة المستأجرين.");
          }
          const pinValid = await bcrypt.compare(password, String(c.pin_hash));
          if (!pinValid) {
            await recordLoginAttempt({ userId: null, email: String(c.phone), ip: auditIp, userAgent: auditUa, success: false, failureReason: "invalid_pin" });
            return badRequest("رمز الدخول غير صحيح.");
          }
          const contract = await ds
            .getRepository("Contract")
            .createQueryBuilder("ct")
            .where("ct.contact_id = :contactId", { contactId: c.id })
            .andWhere("ct.status = :status", { status: "active" })
            .andWhere("ct.deleted_at IS NULL")
            .orderBy("ct.created_at", "DESC")
            .getOne();
          if (!contract) {
            await recordLoginAttempt({ userId: null, email: String(c.phone), ip: auditIp, userAgent: auditUa, success: false, failureReason: "no_active_contract" });
            return badRequest("لا يوجد عقد ساري مرتبط بهذا الرقم.");
          }
          await recordLoginAttempt({ userId: null, email: String(c.phone), ip: auditIp, userAgent: auditUa, success: true });
          const token = await signTenantToken({
            tenantId: String(c.id),
            email: String(c.phone),
            name: String(c.name),
            userType: "tenant",
          });
          const tenantResponse = ok({
            user: {
              id: String(c.id),
              name: String(c.name),
              phone: String(c.phone),
              userType: "tenant",
            },
          });
          tenantResponse.headers.append("Set-Cookie", serializeTenantCookie(token, 7 * 24 * 3600));
          return tenantResponse;
        }
      }
await recordLoginAttempt({ userId: null, email: identifier, ip: auditIp, userAgent: auditUa, success: false, failureReason: "account_not_found" });
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة.");
    }
    const u = user as {
      deleted_at?: string | null;
      is_active?: boolean;
      password_hash: string;
      id: string;
      email: string;
      user_type: string;
      office_id?: string | null;
      token_version?: number | string;
      full_name?: string;
    };
    if (u.deleted_at) {
      await recordLoginAttempt({ userId: u.id, email: u.email, ip: auditIp, userAgent: auditUa, success: false, failureReason: "account_inactive" });
      return badRequest("هذا الحساب غير متاح");
    }
    if (u.is_active === false) {
      await recordLoginAttempt({ userId: u.id, email: u.email, ip: auditIp, userAgent: auditUa, success: false, failureReason: "account_inactive" });
      return badRequest("تم تعطيل هذا الحساب");
    }

    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      await recordLoginAttempt({ userId: u.id, email: u.email, ip: auditIp, userAgent: auditUa, success: false, failureReason: "invalid_password" });
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
    }

    await recordLoginAttempt({ userId: u.id, email: u.email, ip: auditIp, userAgent: auditUa, success: true });
    const accessToken = await signAccessToken({
      userId: u.id,
      email: u.email,
      userType: u.user_type,
      officeId: u.office_id ?? null,
    });

    const tokenVersion = Number(u.token_version) || 0;
    const refreshToken = await signRefreshToken({
      userId: u.id,
      tokenVersion,
    });

    const response = ok({
      accessToken,
      user: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        userType: u.user_type,
        officeId: u.office_id ?? null,
      },
    });

    response.headers.append("Set-Cookie", serializeAuthCookie(TOKEN_COOKIE, accessToken, 15 * 60));
    response.headers.append("Set-Cookie", serializeAuthCookie(REFRESH_COOKIE, refreshToken, 7 * 24 * 3600));
    response.headers.append("Set-Cookie", serializeCsrfCookie(generateCsrfToken()));
    return response;
  } catch (err) {
    return serverError(err);
  }
}
