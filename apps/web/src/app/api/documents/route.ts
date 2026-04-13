import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError } from "@/lib/api-helpers";
import { getAccessibleOwnerIds, assertAgencyCanAccessOwner } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id");
    const contractId = searchParams.get("contract_id");

    const ds = await getDataSource();
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) return ok([]);
    const qb = ds
      .getRepository("Document")
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.property", "property")
      .where("d.owner_id IN (:...ownerIds)", { ownerIds });

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
      return new Response(JSON.stringify({ error: "الملف مطلوب" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ds = await getDataSource();
    const ownerId = String(formData.get("owner_id") ?? user.userId);
    const can = await assertAgencyCanAccessOwner(ds, user, ownerId);
    if (!can) return unauthorized();

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
      property_id: propertyId || null,
      file_name: file.name,
      mime_type: file.type || null,
      object_path: filePath,
      public_url: publicUrl,
      size_bytes: file.size,
      bucket: "local",
      type,
      category: category || null,
    } as any);

    await repo.save(doc);

    // Patch contract_id via raw SQL in case TypeORM entity metadata cache is stale
    if (contractId) {
      await ds.query("UPDATE documents SET contract_id = $1 WHERE id = $2", [contractId, (doc as any).id]);
      (doc as any).contract_id = contractId;
    }

    return created({ ...(doc as any), property: null });
  } catch (err) {
    return serverError(err);
  }
}
