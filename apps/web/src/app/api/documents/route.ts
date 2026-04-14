import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";
import { UuidSchema, badZod } from "@/lib/validation";
import { z } from "zod";

const UploadMetaSchema = z.object({
  property_id: UuidSchema,
  contract_id: UuidSchema.optional().nullable(),
  category: z.string().trim().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const contractId = searchParams.get("contract_id");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const qb = ds
      .getRepository("Document")
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.property", "property")
      .where("1=1");

    if (Array.isArray(propertyIds)) {
      if (propertyIds.length === 0) return ok([]);
      qb.andWhere("d.property_id IN (:...propertyIds)", { propertyIds });
    } else {
      qb.andWhere("d.owner_id = :ownerId", { ownerId: user.userId });
    }

    if (propertyId) qb.andWhere("d.property_id = :propertyId", { propertyId });
    if (contractId) qb.andWhere("d.contract_id = :contractId", { contractId });

    const docs = await qb.orderBy("d.created_at", "DESC").getMany();
    return ok(docs);
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
    const propertyId = formData.get("property_id") as string | null;
    const contractId = formData.get("contract_id") as string | null;
    const category = formData.get("category") as string | null;

    if (!file) {
      return badRequest("الملف مطلوب");
    }

    const ds = await getDataSource();
    const metaParsed = UploadMetaSchema.safeParse({
      property_id: propertyId,
      contract_id: contractId || null,
      category: category || null,
    });
    if (!metaParsed.success) return badRequest(badZod(metaParsed.error));

    const pid = String(metaParsed.data.property_id);
    const can = await assertAgencyCanAccessProperty(ds, user, pid);
    if (!can) return unauthorized();
    const prop = await ds.getRepository("Property").findOne({ where: { id: pid } as any });
    if (!prop) return badRequest("العقار غير موجود");
    const ownerId = String((prop as any).owner_id);

    const uploadsDir = join(process.cwd(), "public", "uploads", ownerId);
    await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${safeName}`;
    const filePath = join(uploadsDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${ownerId}/${fileName}`;

    const mime = file.type;
    let type: string;
    if (mime.startsWith("image/")) type = "image";
    else if (mime === "application/pdf") type = "pdf";
    else if (mime.includes("sheet") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) type = "excel";
    else if (mime.includes("word") || fileName.endsWith(".doc") || fileName.endsWith(".docx")) type = "doc";
    else type = "other";

    const repo = ds.getRepository("Document");

    const doc = repo.create({
      owner_id: ownerId,
      property_id: pid,
      file_name: file.name,
      mime_type: file.type || null,
      object_path: filePath,
      public_url: publicUrl,
      size_bytes: file.size,
      bucket: "local",
      type,
      category: metaParsed.data.category || null,
    } as any);

    await repo.save(doc);

    // Patch contract_id via raw SQL in case TypeORM entity metadata cache is stale
    if (metaParsed.data.contract_id) {
      await ds.query("UPDATE documents SET contract_id = $1 WHERE id = $2", [
        metaParsed.data.contract_id,
        (doc as any).id,
      ]);
      (doc as any).contract_id = metaParsed.data.contract_id;
    }

    return created({ ...(doc as any), property: null });
  } catch (err) {
    return serverError(err);
  }
}
