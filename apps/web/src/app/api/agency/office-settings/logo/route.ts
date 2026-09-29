export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError, badRequest } from "@/lib/api-helpers";
import { localUploadsRoot } from "@/lib/storage";

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
    const extension = path.extname(file.name).toLowerCase() || ".png";
    const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
    if (!allowedExtensions.has(extension)) {
      return badRequest("صيغة الملف غير مدعومة. استخدم PNG, JPG, WebP, أو SVG");
    }
    // Server-generated filename: the client-supplied name (file.name) is never used
    // as an on-disk path component. officeId is the authenticated agency's DB UUID.
    const safeName = `logo_${officeId}_${randomUUID()}${extension}`;

    const uploadDir = path.join(localUploadsRoot(), "logos");
    await mkdir(uploadDir, { recursive: true });

    // Defense-in-depth: keep the final path inside the upload directory.
    // nosemgrep: path-join-resolve-traversal — safeName is server-generated (UUID +
    // allowlist-validated extension), so no client input reaches this path join;
    // the guard below additionally rejects any path escaping uploadDir.
    const filePath = path.resolve(uploadDir, safeName); // nosemgrep: path-join-resolve-traversal
    if (!filePath.startsWith(path.resolve(uploadDir) + path.sep)) {
      return badRequest("مسار الملف غير صالح");
    }
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
