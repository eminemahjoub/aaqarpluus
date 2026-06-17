import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, created, serverError, badRequest } from "@/lib/api-helpers";
import { z } from "zod";
import { UuidSchema, badZod } from "@/lib/validation";
import { buildOwnerContractSummary, ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";
import { createPaymentReceiptPdfBytes } from "@/lib/receipt-pdf";

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

const PaymentItemSchema = z.object({
  contract_id: UuidSchema,
  amount_sar: z.union([z.number(), z.string()]).optional().nullable(),
  due_date: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  status: z.enum(["pending", "paid"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CreatePaymentsSchema = z.union([
  PaymentItemSchema,
  z.array(PaymentItemSchema),
  z.object({ batch: z.array(PaymentItemSchema) }),
]);

async function createReceiptDocument(ds: any, contract: any, payment: any) {
  const pdfBytes = await createPaymentReceiptPdfBytes({ contract, payment });
  const uploadsDir = join(process.cwd(), "public", "uploads", String(contract.owner_id));
  await mkdir(uploadsDir, { recursive: true });
  const contractNumber = contract.extra && typeof contract.extra === "object"
    ? String((contract.extra as { contract_number?: unknown }).contract_number ?? contract.id)
    : contract.id;
  const fileName = `receipt_${payment.id}_${contractNumber}.pdf`;
  const filePath = join(uploadsDir, fileName);
  await writeFile(filePath, Buffer.from(pdfBytes));
  const publicUrl = `/uploads/${contract.owner_id}/${fileName}`;
  const docRepo = ds.getRepository("Document");
  const doc = docRepo.create({
    owner_id: contract.owner_id,
    property_id: contract.property_id,
    file_name: fileName,
    mime_type: "application/pdf",
    object_path: filePath,
    public_url: publicUrl,
    size_bytes: pdfBytes.length,
    bucket: "local",
    type: "pdf",
    category: "payment_receipt",
    contract_id: contract.id,
  } as any);
  await docRepo.save(doc);
  return doc;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contract_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // Join through contracts to ensure ownership
    let qb = ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "Contract",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .orderBy("cp.due_date", "ASC");

    if (contractId) qb = qb.andWhere("cp.contract_id = :contractId", { contractId });
    if (status === "paid") qb = qb.andWhere("cp.status = 'paid'");
    if (status === "pending") qb = qb.andWhere("cp.status != 'paid'");
    if (dateFrom) qb = qb.andWhere("cp.due_date >= :dateFrom", { dateFrom });
    if (dateTo) qb = qb.andWhere("cp.due_date <= :dateTo", { dateTo });

    const payments = await qb.getMany();
    const contractIds = Array.from(new Set((payments ?? []).map((p: any) => String(p.contract_id)).filter(Boolean)));
    const receiptDocs = contractIds.length > 0
      ? await ds.getRepository("Document")
          .createQueryBuilder("d")
          .where("d.category = :category", { category: "payment_receipt" })
          .andWhere("d.contract_id IN (:...contractIds)", { contractIds })
          .getMany()
      : [];
    const receiptByPaymentId = new Map<string, string>();
    for (const doc of receiptDocs) {
      const match = String((doc as any).file_name ?? "").match(/^receipt_([^_]+)_/);
      if (match?.[1]) receiptByPaymentId.set(match[1], String((doc as any).public_url ?? ""));
    }
    const paymentsWithReceipts = (payments ?? []).map((payment: any) => ({
      ...(payment as any),
      receipt_url: receiptByPaymentId.get(String((payment as any).id)) ?? null,
    }));

    if (ownerHidesTenantPii(user)) {
      if (!contractId) return ok({ summaries: [] });
      const contract = await ds.getRepository("Contract").findOne({ where: { id: contractId } as any });
      if (!contract) return unauthorized();
      const summary = buildOwnerContractSummary({
        end_date: (contract as any).end_date,
        start_date: (contract as any).start_date,
        payments,
      });
      return ok({ summary });
    }

    return ok(paymentsWithReceipts);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (ownerHidesTenantPii(user)) return unauthorized();

    const raw = await req.json();
    const parsed = CreatePaymentsSchema.safeParse(raw);
    if (!parsed.success) return badRequest(badZod(parsed.error));

    const ds = await getDataSource();

    // Support batch insert (array), { batch: [...] }, or single
    const body = parsed.data as any;
    const items = Array.isArray(body) ? body : Array.isArray(body?.batch) ? body.batch : [body];
    if (items.length === 0) return badRequest("البيانات مطلوبة");

    const repo = ds.getRepository("ContractPayment");
    const saved = [];

    // Authorization: only allow adding payments to accessible contracts
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const contractIds = Array.from(new Set(items.map((i: any) => String(i.contract_id)).filter(Boolean)));
    if (contractIds.length === 0) return badRequest("معرف العقد مطلوب");

    const allowedRows = await ds.query(
      Array.isArray(propertyIds)
        ? `SELECT id FROM contracts WHERE id = ANY($1::uuid[]) AND property_id = ANY($2::uuid[])`
        : `SELECT id FROM contracts WHERE id = ANY($1::uuid[]) AND owner_id = $2`,
      Array.isArray(propertyIds) ? [contractIds, propertyIds] : [contractIds, user.userId]
    );
    const allowed = new Set((allowedRows ?? []).map((r: any) => String(r.id)));

    for (const item of items) {
      const cid = String(item.contract_id);
      if (!allowed.has(cid)) return unauthorized();
      const payment = repo.create({
        contract_id: cid,
        amount_sar:
          item.amount_sar != null && String(item.amount_sar).trim() !== "" ? Number(item.amount_sar) : 0,
        due_date: item.due_date ?? null,
        paid_at: item.paid_at ?? null,
        status: item.status ?? "pending",
        notes: item.notes ?? null,
      } as any);
      await repo.save(payment);
      if (String((payment as any).status) === "paid") {
        const contract = await ds
          .getRepository("Contract")
          .createQueryBuilder("c")
          .leftJoinAndSelect("c.contact", "contact")
          .leftJoinAndSelect("c.property", "property")
          .leftJoinAndSelect("c.unit", "unit")
          .where("c.id = :id", { id: cid })
          .getOne();
        if (contract) {
          await ds.query("DELETE FROM documents WHERE category = $1 AND file_name LIKE $2", [
            "payment_receipt",
            `receipt_${(payment as any).id}_%`,
          ]);
          await createReceiptDocument(ds, contract, payment);
        }
      }
      saved.push(payment);
    }

    return created(saved.length === 1 ? saved[0] : saved);
  } catch (err) {
    return serverError(err);
  }
}
