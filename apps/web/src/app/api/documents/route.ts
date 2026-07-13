export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { UuidSchema, badZod } from "@/lib/validation";
import { z } from "zod";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null;
  const agencyId = String(user.userId);
  const rows = await ds.query(
    `SELECT id FROM properties
     WHERE deleted_at IS NULL
       AND (created_by_agency_id = $1 OR owner_id = $1 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = owner_id
           AND u.created_by_agency_id = $1
           AND u.deleted_at IS NULL
       ))`,
    [agencyId]
  );
  const ids: string[] = Array.from(new Set((rows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
  return ids.length > 0 ? ids : [];
}

async function assertCanAccessProperty(ds: any, user: any, propertyId: string) {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return true;
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  if (officeId) {
    const linked = await ds.query(
      "SELECT 1 AS ok FROM office_property_links WHERE office_id = $1 AND property_id = $2 LIMIT 1",
      [officeId, propertyId]
    );
    if (Array.isArray(linked) && linked.length > 0) return true;
  }
  const rows = await ds.query(
    `SELECT 1 AS ok FROM properties p
     WHERE p.id = $1 AND p.deleted_at IS NULL
       AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = p.owner_id
           AND u.created_by_agency_id = $2
           AND u.deleted_at IS NULL
       ))
     LIMIT 1`,
    [propertyId, agencyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

const UploadMetaSchema = z.object({
  property_id: UuidSchema.optional().nullable(),
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
      .where("d.deleted_at IS NULL");

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

    const pid = metaParsed.data.property_id;
    let ownerId: string;

    if (pid) {
      const can = await assertCanAccessProperty(ds, user, pid);
      if (!can) return unauthorized();
      const prop = await ds.getRepository("Property").findOne({ where: { id: pid } as any });
      if (!prop) return badRequest("العقار غير موجود");
      ownerId = String((prop as any).owner_id);
    } else {
      ownerId = user.userId;
    }

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
      property_id: pid || null,
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
