import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const unitId = searchParams.get("unit_id");
    const componentId = searchParams.get("component_id");
    const imageType = searchParams.get("image_type");

    const ds = await getDataSource();
    let qb = ds
      .getRepository("PropertyImage")
      .createQueryBuilder("pi")
      .where("pi.owner_id = :ownerId", { ownerId: user.userId })
      .orderBy("pi.created_at", "ASC");

    if (propertyId) qb = qb.andWhere("pi.property_id = :propertyId", { propertyId });
    if (unitId) qb = qb.andWhere("pi.unit_id = :unitId", { unitId });
    if (componentId) qb = qb.andWhere("pi.component_id = :componentId", { componentId });
    if (imageType) qb = qb.andWhere("pi.image_type = :imageType", { imageType });

    const images = await qb.getMany();
    return ok(images);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return serverError("الملف مطلوب");

    const propertyId = formData.get("property_id") as string | null;
    const unitId = formData.get("unit_id") as string | null;
    const componentId = formData.get("component_id") as string | null;
    const imageType = (formData.get("image_type") as string | null) ?? "gallery";

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".jpg";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

    // Store in /public/uploads/properties/<ownerId>/ or /public/uploads/units/<ownerId>/
    const subDir = unitId ? "units" : "properties";
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      subDir,
      user.userId,
    );
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${subDir}/${user.userId}/${safeName}`;
    const objectPath = filePath;

    const ds = await getDataSource();
    const repo = ds.getRepository("PropertyImage");

    const image = repo.create({
      owner_id: user.userId,
      property_id: propertyId || null,
      unit_id: unitId || null,
      component_id: componentId || null,
      image_type: imageType,
      file_name: file.name,
      public_url: publicUrl,
      object_path: objectPath,
      size_bytes: buffer.byteLength,
    } as any);

    await repo.save(image);
    return created(image);
  } catch (err) {
    return serverError(err);
  }
}
