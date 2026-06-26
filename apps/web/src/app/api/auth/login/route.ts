import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signAccessToken, signRefreshToken, TOKEN_COOKIE, REFRESH_COOKIE, serializeAuthCookie, generateCsrfToken, serializeCsrfCookie } from "@/lib/auth";
import { signTenantToken, serializeTenantCookie } from "@/lib/tenant-auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "البريد الإلكتروني/رقم الجوال مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`login:${ip}`, 10, 300))) return badRequest("محاولات كثيرة، حاول لاحقاً");

    const body = await req.json();
    const parsed = LoginSchema.safeParse({
      identifier: body.identifier ?? body.email ?? "",
      password: body.password ?? "",
    });
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const rawIdentifier = parsed.data.identifier;
    const password = parsed.data.password;

    const normalizePhone = (s: string) => {
      const p = s.replace(/\s+/g, "");
      if (/^05\d{8}$/.test(p)) return `+966${p.substring(1)}`;
      if (/^\+9665\d{8}$/.test(p)) return p;
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
        const contact = await ds
          .getRepository("Contact")
          .createQueryBuilder("c")
          .where("c.phone = :phone OR c.alternative_phone = :phone", { phone: tenantPhone })
          .andWhere("c.deleted_at IS NULL")
          .getOne();
        if (contact) {
          const c = contact as { pin_hash?: string; id?: string; name?: string; phone?: string };
          if (c.pin_hash && await bcrypt.compare(password, String(c.pin_hash))) {
            const contract = await ds
              .getRepository("Contract")
              .createQueryBuilder("ct")
              .where("ct.contact_id = :contactId", { contactId: c.id })
              .andWhere("ct.status = :status", { status: "active" })
              .andWhere("ct.deleted_at IS NULL")
              .orderBy("ct.created_at", "DESC")
              .getOne();
            if (contract) {
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
        }
      }
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
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
      return badRequest("هذا الحساب غير متاح");
    }
    if (u.is_active === false) {
      return badRequest("تم تعطيل هذا الحساب");
    }

    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
    }

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
