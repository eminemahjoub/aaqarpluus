import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIdentifier = String(body.identifier ?? body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!rawIdentifier || !password) {
      return badRequest("البريد الإلكتروني/رقم الجوال وكلمة المرور مطلوبان");
    }

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

    const valid = await bcrypt.compare(password, (user as any).password_hash);
    if (!valid) {
      return badRequest("البريد الإلكتروني/رقم الجوال أو كلمة المرور غير صحيحة");
    }

    const token = await signToken({
      userId: (user as any).id,
      email: (user as any).email,
      userType: (user as any).user_type,
      officeId: (user as any).office_id ?? null,
    });

    const response = ok({
      token,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        fullName: (user as any).full_name,
        userType: (user as any).user_type,
        officeId: (user as any).office_id ?? null,
      },
    });

    response.headers.set(
      "Set-Cookie",
      `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    );
    return response;
  } catch (err) {
    return serverError(err);
  }
}
