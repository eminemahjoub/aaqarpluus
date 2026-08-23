export const dynamic = "force-dynamic";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created } from "@/lib/api-helpers";
import { badRequest } from "@/lib/errors";
import { UuidSchema, badZod } from "@/lib/validation";
import { buildOwnerContractSummary, ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";
import { syncRevenueForPayment } from "@/lib/contract-payment-revenue";
import { createPaymentReceiptPdfBytes } from "@/lib/receipt-pdf";
import { generatePaymentSchedule } from "@/lib/auto-payments";
import { paymentMethodSchema } from "@/lib/validation/payments";
import {
  withAuth,
  resolveContext,
  assertContractAccess,
  requireCapability,
  getPropertyIdsForContext,
  AuthError,
  type UserContext,
} from "@/lib/auth/scope";

/**
 * Contract payments collection routes — scoped via @/lib/auth/scope.
 *
 * GET: optional contract_id (assertContractAccess first); without it, listing
 * scopes through the property chain (getPropertyIdsForContext) or, for
 * owners, through contracts they own. Preserves legacy status/date filters,
 * receipt_url resolution from documents, and the owner-PII summary shape
 * ({ summary } / { summaries: [] }).
 *
 * POST: legacy body shapes (single item, array, or { batch: [...] }) are
 * preserved for existing consumers; the new { contract_id, payments: [...] }
 * shape is also accepted. Empty payments in the new shape auto-generates a
 * schedule via generatePaymentSchedule (same generator used at contract
 * creation). Legacy owner/personal deny is preserved via ownerHidesTenantPii.
 */

const PaymentItemSchema = z.object({
  contract_id: UuidSchema,
  amount_sar: z.number().positive("المبلغ يجب أن يكون أكبر من صفر").optional().nullable(),
  due_date: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  status: z.enum(["pending", "paid"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  payment_method: paymentMethodSchema.optional().nullable(),
});

const CreatePaymentsSchema = z.union([
  PaymentItemSchema,
  z.array(PaymentItemSchema),
  z.object({ batch: z.array(PaymentItemSchema) }),
]);

// New shape: { contract_id, payments: [{ amount, due_date, payment_method? }] }
const NewPaymentBodySchema = z.object({
  contract_id: UuidSchema,
  payments: z.array(
    z.object({
      amount: z.number().positive().optional(),
      amount_sar: z.number().positive().optional(),
      due_date: z.string().optional().nullable(),
      payment_method: paymentMethodSchema.optional().nullable(),
    })
  ),
});

async function createReceiptDocument(ds: any, contract: any, payment: any) {
  const pdfBytes = await createPaymentReceiptPdfBytes({ contract, payment });
  // nosemgrep: path-join-resolve-traversal — owner_id is a DB UUID from the
  // ownership-verified contract; the resolved path is guard-checked below.
  const uploadsDir = path.join(process.cwd(), "public", "uploads", String(contract.owner_id)); // nosemgrep: path-join-resolve-traversal
  await mkdir(uploadsDir, { recursive: true });
  const contractNumber = contract.extra && typeof contract.extra === "object"
    ? String((contract.extra as { contract_number?: unknown }).contract_number ?? contract.id)
    : contract.id;
  // Keep the `receipt_<paymentId>_` prefix: GET /api/contract-payments parses it
  // (/^receipt_([^_]+)_/) to map payments to receipt URLs. payment.id is DB-issued;
  // contractNumber comes from contract.extra (user-editable), so sanitize it.
  const safeContractNumber = contractNumber.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const fileName = `receipt_${String(payment.id)}_${safeContractNumber}.pdf`;
  // Defense-in-depth: refuse to write outside the upload directory.
  // nosemgrep: path-join-resolve-traversal — fileName is built from the DB-issued
  // payment UUID and a sanitized contract number (alphanumeric only), so it cannot
  // traverse; the guard below enforces this regardless.
  const filePath = path.resolve(uploadsDir, fileName); // nosemgrep: path-join-resolve-traversal
  // nosemgrep: path-join-resolve-traversal — this is the traversal guard itself.
  if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
    throw new Error("Invalid receipt file path");
  }
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

async function insertPaymentItems(ds: any, items: any[]) {
  const repo = ds.getRepository("ContractPayment");
  const saved = [];
  for (const item of items) {
    const cid = String(item.contract_id);
    const payment = repo.create({
      contract_id: cid,
      amount_sar:
        item.amount_sar != null && String(item.amount_sar).trim() !== "" ? Number(item.amount_sar) : 0,
      due_date: item.due_date ?? null,
      paid_at: item.paid_at ?? null,
      status: item.status ?? "pending",
      notes: item.notes ?? null,
      payment_method: item.payment_method ?? "cash",
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
        await syncRevenueForPayment(contract, payment, ds);
      }
    }
    saved.push(payment);
  }
  return saved;
}

export const GET = withAuth<UserContext>(
  async () => resolveContext(),
  async (ctx, req) => {
    const url = new URL(req.url);
    const contractId = url.searchParams.get("contract_id");
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    const ds = await getDataSource();
    if (contractId) await assertContractAccess(ctx, contractId);

    let qb = ds.getRepository("ContractPayment").createQueryBuilder("cp");
    if (contractId) {
      qb = qb
        .innerJoin("Contract", "c", "c.id = cp.contract_id")
        .where("cp.contract_id = :contractId", { contractId });
    } else if (ctx.role === "owner") {
      // owners/personal: payments of contracts they own (legacy owner_id join)
      qb = qb.innerJoin("Contract", "c", "c.id = cp.contract_id AND c.owner_id = :ownerId", {
        ownerId: ctx.userId,
      });
    } else {
      const ids = await getPropertyIdsForContext(ctx);
      if (ids !== null) {
        if (ids.length === 0) return ok([]);
        qb = qb.innerJoin("Contract", "c", "c.id = cp.contract_id AND c.property_id IN (:...ids)", { ids });
      } else {
        qb = qb.innerJoin("Contract", "c", "c.id = cp.contract_id");
      }
    }

    qb = qb.orderBy("cp.due_date", "ASC");
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

    if (ownerHidesTenantPii({ userType: ctx.userType })) {
      if (!contractId) return ok({ summaries: [] });
      const contract = await ds.getRepository("Contract").findOne({ where: { id: contractId } as any });
      if (!contract) throw new AuthError("غير موجود", 404);
      const summary = buildOwnerContractSummary({
        end_date: (contract as any).end_date,
        start_date: (contract as any).start_date,
        payments,
      });
      return ok({ summary });
    }

    return ok(paymentsWithReceipts);
  }
);

export const POST = withAuth<UserContext>(
  async () => {
    const ctx = await resolveContext();
    requireCapability(ctx, "payments_mutate");
    // Legacy rule: owners/personal cannot create payment rows (payment
    // collection is agency work). Kept to avoid loosening permissions.
    if (ownerHidesTenantPii({ userType: ctx.userType })) {
      throw new AuthError("ممنوع", 403);
    }
    return ctx;
  },
  async (ctx, req) => {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") throw badRequest("البيانات مطلوبة");

    const ds = await getDataSource();

    // New shape: { contract_id, payments: [...] } — auto-generate when empty
    const newShape = NewPaymentBodySchema.safeParse(raw);
    if (newShape.success) {
      const { contract_id, payments } = newShape.data;
      await assertContractAccess(ctx, String(contract_id));

      let items = payments.map((p) => ({
        contract_id: String(contract_id),
        amount_sar: Number(p.amount_sar ?? p.amount),
        due_date: p.due_date ?? null,
        paid_at: null,
        status: "pending",
        notes: null,
        payment_method: p.payment_method ?? "cash",
      }));

      if (items.length === 0) {
        // Auto-generate installments from the contract (same generator used at
        // contract creation in /api/contracts).
        const contract = await ds.getRepository("Contract").findOne({ where: { id: contract_id } as any });
        if (!contract) throw new AuthError("غير موجود", 404);
        const schedule = generatePaymentSchedule({
          rent_total_sar: Number((contract as any).rent_total_sar) || 0,
          start_date: String((contract as any).start_date ?? ""),
          end_date: String((contract as any).end_date ?? ""),
          payment_frequency: (contract as any).payment_frequency ?? null,
          installments_count: (contract as any).installments_count ?? null,
        });
        items = schedule.map((s) => ({
          contract_id: String(contract_id),
          amount_sar: s.amount_sar,
          due_date: s.due_date,
          paid_at: null,
          status: "pending",
          notes: null,
          payment_method: "cash",
        }));
      }

      const saved = await insertPaymentItems(ds, items);
      return created(saved.length === 1 ? saved[0] : saved);
    }

    // Legacy shapes: single item, array, or { batch: [...] }
    const parsed = CreatePaymentsSchema.safeParse(raw);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const body = parsed.data as any;
    const items = Array.isArray(body) ? body : Array.isArray(body?.batch) ? body.batch : [body];
    if (items.length === 0) throw badRequest("البيانات مطلوبة");

    const contractIds: string[] = Array.from(
      new Set(items.map((i: any) => String(i.contract_id ?? "")).filter((s: string) => Boolean(s)))
    );
    if (contractIds.length === 0) throw badRequest("معرف العقد مطلوب");
    for (const cid of contractIds) await assertContractAccess(ctx, cid);

    const saved = await insertPaymentItems(ds, items);
    return created(saved.length === 1 ? saved[0] : saved);
  }
);