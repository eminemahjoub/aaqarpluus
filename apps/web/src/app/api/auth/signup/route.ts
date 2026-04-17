import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { signAccessToken, signRefreshToken, TOKEN_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { ok, badRequest, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { EmailSchema, SaudiPhoneSchema, badZod } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

function authCookie(name: string, token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

const SignupSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  fullName: z.string().trim().min(1, "الاسم مطلوب"),
  phone: SaudiPhoneSchema,
  userType: z.enum(["owner", "agency"]).default("owner"),
  officeName: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`signup:${ip}`, 10, 300)) return badRequest("طلبات كثيرة، حاول لاحقاً");

    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const { email, password, fullName, phone, userType, officeName } = parsed.data;

    const ds = await getDataSource();
    const repo = ds.getRepository("User");

    const existing = await repo
      .createQueryBuilder("u")
      .where("u.email = :email", { email })
      .getOne();

    if (existing) {
      return badRequest("هذا البريد الإلكتروني مسجل مسبقاً");
    }

    const existingPhone = await repo
      .createQueryBuilder("u")
      .where("u.phone = :phone", { phone })
      .andWhere("u.deleted_at IS NULL")
      .getOne();

    if (existingPhone) {
      return badRequest("رقم الجوال مستخدم مسبقاً");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // If signing up as an agency (office), create an office and attach office_id.
    // Members creation is handled via /api/offices/members later.
    let officeId: string | null = null;
    if (userType === "agency") {
      const officeRepo = ds.getRepository("Office");
      const office = officeRepo.create({
        name: String(officeName ?? fullName ?? "مكتب").trim() || "مكتب",
      } as any);
      await officeRepo.save(office);
      officeId = (office as any).id ? String((office as any).id) : null;
    }

    const user = repo.create({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone,
      user_type: userType,
      office_id: officeId,
    } as any);

    await repo.save(user);

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
