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

    if (!email || !password) {
      return badRequest("البريد الإلكتروني وكلمة المرور مطلوبان");
    }

    const ds = await getDataSource();
    const user = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.email = :email", { email })
      .getOne();

    if (!user) {
      return badRequest("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }

    const valid = await bcrypt.compare(password, (user as any).password_hash);
    if (!valid) {
      return badRequest("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }

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
