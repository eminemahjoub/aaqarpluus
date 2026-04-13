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
    const rawPhone = String(body.phone ?? "").trim();
    const userTypeRaw = String(body.userType ?? "owner");
    const userType = userTypeRaw === "agency" ? "agency" : "owner";

    if (!email || !password || !fullName || !rawPhone) {
      return badRequest("الاسم والبريد الإلكتروني ورقم الجوال وكلمة المرور مطلوبة");
    }
    if (password.length < 6) {
      return badRequest("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    // Normalize phone to E.164 (Saudi) if possible.
    const phone = (() => {
      const p = rawPhone.replace(/\s+/g, "");
      if (/^05\d{8}$/.test(p)) return `+966${p.substring(1)}`;
      if (/^\+9665\d{8}$/.test(p)) return p;
      return null;
    })();

    if (!phone) {
      return badRequest("رقم الجوال غير صحيح. أدخل رقم يبدأ بـ 05 (10 أرقام) أو بصيغة +9665XXXXXXXX");
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

    // If signing up as an agency (office), create an office and attach office_id.
    // Members creation is handled via /api/offices/members later.
    let officeId: string | null = null;
    if (userType === "agency") {
      const officeRepo = ds.getRepository("Office");
      const office = officeRepo.create({
        name: String(body.officeName ?? fullName ?? "مكتب").trim() || "مكتب",
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
