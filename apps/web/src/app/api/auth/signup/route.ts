import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim() || null;
    const userType = String(body.userType ?? "owner");

    if (!email || !password || !fullName) {
      return badRequest("الاسم والبريد الإلكتروني وكلمة المرور مطلوبة");
    }
    if (password.length < 6) {
      return badRequest("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    const ds = await getDataSource();
    const repo = ds.getRepository("User");

    const existing = await repo
      .createQueryBuilder("u")
      .where("u.email = :email", { email })
      .getOne();

    if (existing) {
      return badRequest("هذا البريد الإلكتروني مسجل مسبقاً");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = repo.create({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone,
      user_type: userType,
    } as any);

    await repo.save(user);

    const token = await signToken({
      userId: (user as any).id,
      email: (user as any).email,
      userType: (user as any).user_type,
    });

    const response = ok({
      token,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        fullName: (user as any).full_name,
        userType: (user as any).user_type,
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
