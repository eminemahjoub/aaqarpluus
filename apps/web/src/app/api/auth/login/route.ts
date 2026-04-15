import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signAccessToken, signRefreshToken, TOKEN_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

function authCookie(name: string, token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Lax is OK for top-level navigations; HttpOnly prevents JS access.
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "البريد الإلكتروني/رقم الجوال مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`login:${ip}`, 10, 300)) return badRequest("محاولات كثيرة، حاول لاحقاً");

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
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
    }
    if ((user as any).deleted_at) {
      return badRequest("هذا الحساب غير متاح");
    }
    if ((user as any).is_active === false) {
      return badRequest("تم تعطيل هذا الحساب");
    }

    const valid = await bcrypt.compare(password, (user as any).password_hash);
    if (!valid) {
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
    }

    const accessToken = await signAccessToken({
      userId: (user as any).id,
      email: (user as any).email,
      userType: (user as any).user_type,
      officeId: (user as any).office_id ?? null,
    });

    const tokenVersion = Number((user as any).token_version) || 0;
    const refreshToken = await signRefreshToken({
      userId: (user as any).id,
      tokenVersion,
    });

    const response = ok({
      accessToken,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        fullName: (user as any).full_name,
        userType: (user as any).user_type,
        officeId: (user as any).office_id ?? null,
      },
    });

    response.headers.append("Set-Cookie", authCookie(TOKEN_COOKIE, accessToken, 15 * 60));
    response.headers.append("Set-Cookie", authCookie(REFRESH_COOKIE, refreshToken, 7 * 24 * 3600));
    return response;
  } catch (err) {
    return serverError(err);
  }
}
