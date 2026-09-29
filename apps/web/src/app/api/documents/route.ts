export const dynamic = "force-dynamic";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created } from "@/lib/api-helpers";
import { localUploadsRoot } from "@/lib/storage";
import { badRequest } from "@/lib/errors";
import { UuidSchema, badZod } from "@/lib/validation";
import {
  withAuth,
  resolveContext,
  assertPropertyAccess,
  assertContractAccess,
  requireCapability,
  getPropertyIdsForContext,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * Documents routes — scoped via @/lib/auth/scope.
 *
 * GET supports:
 *  - legacy params: property_id / contract_id (asserted via scope helpers)
 *  - new scope params: scope_type=property|contract|owner + scope_id
 *    ("owner" scope: owners see their own docs; agencies see docs of owners
 *    linked via office_owner_links; admin unrestricted)
 *  - default listing preserves legacy behavior: owners see docs they uploaded,
 *    offices see docs on accessible properties.
 * Response is a direct array (frontend maps over res.json()).
 *
 * POST is the multipart file-upload endpoint: file + optional property_id /
 * contract_id / category. The Document row metadata (file_name, public_url,
 * object_path) is derived server-side — clients never supply paths. Uploads
 * now require documents_mutate and real property access (the legacy check
 * allowed any non-agency user to attach documents to arbitrary properties).
 */

const UploadMetaSchema = z.object({
  property_id: UuidSchema.optional().nullable(),
  contract_id: UuidSchema.optional().nullable(),
  category: z.string().trim().optional().nullable(),
});

const SCOPE_TYPES = ["property", "contract", "owner"] as const;

export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx, req) => {
    const ds = await getDataSource();
    const url = new URL(req.url);
    const scopeType = url.searchParams.get("scope_type");
    const scopeId = url.searchParams.get("scope_id");
    const propertyId = url.searchParams.get("property_id");
    const contractId = url.searchParams.get("contract_id");

    let qb = ds
      .getRepository("Document")
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.property", "property")
      .where("d.deleted_at IS NULL");

    if (scopeType) {
      if (!SCOPE_TYPES.includes(scopeType as any) || !scopeId) {
        throw badRequest("scope_type/scope_id غير صالح");
      }

      if (scopeType === "property") {
        await assertPropertyAccess(ctx, scopeId);
        qb = qb.andWhere("d.property_id = :scopeId", { scopeId });
      } else if (scopeType === "contract") {
        await assertContractAccess(ctx, scopeId);
        qb = qb.andWhere("d.contract_id = :scopeId", { scopeId });
      } else {
        // owner scope: self-scoped for owners/personal; agencies see docs of
        // owners linked via office_owner_links; admin unrestricted.
        if (ctx.role === "admin") {
          // no extra filter
        } else if (ctx.role === "owner") {
          qb = qb.andWhere("d.owner_id = :ownerId", { ownerId: ctx.userId });
        } else if (ctx.officeId) {
          qb = qb.andWhere(
            `d.owner_id = :selfId OR EXISTS (
               SELECT 1 FROM office_owner_links l
                WHERE l.office_id = :officeId AND l.owner_id = d.owner_id
             )`,
            { selfId: ctx.userId, officeId: ctx.officeId }
          );
        } else {
          qb = qb.andWhere("d.owner_id = :selfId", { selfId: ctx.userId });
        }
        // Optional narrowing to a specific owner when scope_id differs from self
        if (scopeId && scopeId !== ctx.userId) {
          qb = qb.andWhere("d.owner_id = :scopeId", { scopeId });
        }
      }
      return ok(await qb.orderBy("d.created_at", "DESC").getMany());
    }

    if (contractId) {
      await assertContractAccess(ctx, contractId);
      return ok(await qb.andWhere("d.contract_id = :contractId", { contractId }).orderBy("d.created_at", "DESC").getMany());
    }

    if (propertyId) {
      await assertPropertyAccess(ctx, propertyId);
      return ok(await qb.andWhere("d.property_id = :propertyId", { propertyId }).orderBy("d.created_at", "DESC").getMany());
    }

    // Default listing (legacy behavior)
    if (ctx.role === "owner") {
      qb = qb.andWhere("d.owner_id = :ownerId", { ownerId: ctx.userId });
    } else {
      const ids = await getPropertyIdsForContext(ctx);
      if (ids !== null) {
        if (ids.length === 0) return ok([]);
        qb = qb.andWhere("d.property_id IN (:...ids)", { ids });
      }
    }

    return ok(await qb.orderBy("d.created_at", "DESC").getMany());
  }
);

export const POST = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireCapability(ctx, "documents_mutate");
    return ctx;
  },
  async (ctx, req) => {
    // Next truncates request bodies beyond 10MB before the handler runs —
    // a failed FormData parse here means the upload exceeded the cap, so
    // surface it as a friendly 400 instead of a 500.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw badRequest("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
    }
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("property_id") as string | null;
    const contractId = formData.get("contract_id") as string | null;
    const category = formData.get("category") as string | null;

    if (!file) throw badRequest("الملف مطلوب");

    // Server-side envelope cap — the disk-filler guard (the API stays
    // type-permissive on purpose: legacy documents page uploads Excel/images,
    // tasks page attaches arbitrary files).
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      throw badRequest("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
    }

    const ds = await getDataSource();
    const metaParsed = UploadMetaSchema.safeParse({
      property_id: propertyId,
      contract_id: contractId || null,
      category: category || null,
    });
    if (!metaParsed.success) throw badRequest(badZod(metaParsed.error));

    const pid = metaParsed.data.property_id;
    let ownerId: string;

    if (pid) {
      await assertPropertyAccess(ctx, pid);
      const prop = await ds.getRepository("Property").findOne({ where: { id: pid } as any });
      if (!prop) throw badRequest("العقار غير موجود");
      ownerId = String((prop as any).owner_id);
    } else {
      ownerId = ctx.userId;
    }

    // nosemgrep: path-join-resolve-traversal — ownerId is the DB UUID of the
    // ownership-verified property; the resolved path is guard-checked below.
    const uploadsDir = path.join(localUploadsRoot(), ownerId); // nosemgrep: path-join-resolve-traversal
    await mkdir(uploadsDir, { recursive: true });

    // Server-generated on-disk name: the client-supplied name is never used as a
    // path component. The original name is kept in the `file_name` DB field for
    // display only. The extension is preserved (documents accept many file types)
    // but constrained to a short alphanumeric suffix with no path separators.
    const rawExt = path.extname(file.name).toLowerCase();
    const extension = /^\.[a-zA-Z0-9]{1,10}$/.test(rawExt) ? rawExt : "";
    const fileName = `${Date.now()}_${randomUUID()}${extension}`;
    // Defense-in-depth: keep the final path inside the owner's upload directory.
    // nosemgrep: path-join-resolve-traversal — fileName is server-generated
    // (timestamp + UUID + constrained extension), so it cannot traverse; the
    // guard below enforces this regardless.
    const filePath = path.resolve(uploadsDir, fileName); // nosemgrep: path-join-resolve-traversal
    // nosemgrep: path-join-resolve-traversal — this is the traversal guard itself.
    if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
      throw badRequest("مسار الملف غير صالح");
    }

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
  }
);