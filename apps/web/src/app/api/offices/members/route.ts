import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest, created } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    if (!officeId) return badRequest("office_id غير موجود");

    const ds = await getDataSource();
    const members = await ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.office_id = :officeId", { officeId })
      .orderBy("u.created_at", "DESC")
      .getMany();
    return ok(
      (members ?? []).map((m: any) => ({
        id: String(m.id),
        email: String(m.email),
        full_name: m.full_name ?? null,
        phone: m.phone ?? null,
        user_type: m.user_type ?? null,
        office_id: m.office_id ?? null,
        created_at: m.created_at ?? null,
      }))
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    if (!officeId) return badRequest("office_id غير موجود");

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim() || null;
    const phone = String(body.phone ?? "").trim() || null;

    if (!email || !password) return badRequest("الإيميل وكلمة المرور مطلوبة");
    if (password.length < 6) return badRequest("كلمة المرور يجب أن تكون 6 أحرف على الأقل");

    const ds = await getDataSource();
    const repo = ds.getRepository("User");
    const existing = await repo.createQueryBuilder("u").where("u.email = :email", { email }).getOne();
    if (existing) return badRequest("هذا البريد الإلكتروني مسجل مسبقاً");

    const passwordHash = await bcrypt.hash(password, 12);
    const member = repo.create({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone,
      user_type: "agency",
      office_id: officeId,
    } as any);
    await repo.save(member);
    return created({ id: (member as any).id, email, full_name: fullName, phone, user_type: "agency", office_id: officeId });
  } catch (err) {
    return serverError(err);
  }
}

