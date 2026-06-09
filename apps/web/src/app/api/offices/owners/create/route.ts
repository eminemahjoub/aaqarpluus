import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/db/data-source";
import {
  getUserFromRequest,
  unauthorized,
  badRequest,
  created,
  serverError,
} from "@/lib/api-helpers";
import { z } from "zod";
import { EmailSchema, SaudiPhoneSchema, badZod } from "@/lib/validation";

const CreateOwnerSchema = z.object({
  firstName: z.string().trim().min(1, "الاسم الأول مطلوب"),
  lastName: z.string().trim().min(1, "اسم العائلة مطلوب"),
  email: EmailSchema,
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  phone: SaudiPhoneSchema,
  idNumber: z.string().trim().min(1, "رقم الهوية / البطاقة الوطنية مطلوب"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();
    const officeId = user.officeId ? String(user.officeId) : null;
    const agencyId = String(user.userId);

    const body = await req.json();
    const parsed = CreateOwnerSchema.safeParse(body);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const { firstName, lastName, email, password, phone, idNumber } = parsed.data;

    const ds = await getDataSource();
    const userRepo = ds.getRepository("User");

    const existingEmail = await userRepo
      .createQueryBuilder("u")
      .where("u.email = :email", { email })
      .getOne();
    if (existingEmail) return badRequest("هذا البريد الإلكتروني مسجل مسبقاً");

    const existingPhone = await userRepo
      .createQueryBuilder("u")
      .where("u.phone = :phone", { phone })
      .andWhere("u.deleted_at IS NULL")
      .getOne();
    if (existingPhone) return badRequest("رقم الجوال مستخدم مسبقاً");

    const passwordHash = await bcrypt.hash(password, 12);

    const owner = userRepo.create({
      email,
      password_hash: passwordHash,
      full_name: `${firstName} ${lastName}`,
      phone,
      id_number: idNumber,
      user_type: "owner",
      created_by_agency_id: agencyId,
    } as any);

    await userRepo.save(owner);
    const ownerId = String((owner as any).id);

    let linkId: string | null = null;
    if (officeId) {
      const linkRepo = ds.getRepository("OfficeOwnerLink");
      const link = linkRepo.create({
        office_id: officeId,
        owner_id: ownerId,
      } as any);
      await linkRepo.save(link);
      linkId = String((link as any).id);
    }

    return created({
      link_id: linkId,
      owner_id: ownerId,
      full_name: (owner as any).full_name,
      email: (owner as any).email,
      phone: (owner as any).phone,
    });
  } catch (err) {
    return serverError(err);
  }
}
