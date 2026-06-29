export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();

    const officeId = String(user.officeId ?? "");
    if (!officeId) return badRequest("لا يوجد مكتب مرتبط بحسابك");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return badRequest("الملف مطلوب");

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return badRequest("صيغة الملف غير مدعومة. استخدم PNG, JPG, WebP, أو SVG");
    }

    if (file.size > 2 * 1024 * 1024) {
      return badRequest("حجم الملف كبير جداً. الحد الأقصى 2 ميجابايت");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".png";
    const safeName = `logo_${officeId}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/logos/${safeName}`;

    const ds = await getDataSource();
    await ds.query(`UPDATE offices SET logo_url = $1, updated_at = NOW() WHERE id = $2`, [publicUrl, officeId]);

    return ok({ logo_url: publicUrl });
  } catch (err) {
    console.error("[office-logo upload] error:", err);
    return serverError(err);
  }
}
