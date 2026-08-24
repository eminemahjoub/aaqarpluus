export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  assertContractAccess,
  requireCapability,
  AuthError,
  type ContractContext,
} from "@/lib/auth/scope";
import { syncRevenueForPayment, deleteRevenueForPayment } from "@/lib/contract-payment-revenue";
import { createPaymentReceiptPdfBytes } from "@/lib/receipt-pdf";
import { notifications } from "@/lib/notifications";
import {
  generateInvoiceNumber,
  generateZATCAQR,
  generateZATCAXML,
  hashInvoice,
  type ZATCAInvoiceData,
} from "@/lib/zatca";
import { hasPlanFeature } from "@/lib/billing/plans";

/**
 * Contract payments routes — scoped via @/lib/auth/scope.
 * The payment row is looked up to derive contract_id, then assertContractAccess
 * enforces property-level access (404 on missing payment, missing contract, or
 * unauthorized).
 *
 * Notes:
 *  - `receipt_url` is not a stored column — receipts are regenerated as
 *    documents when a payment becomes paid (see PUT) and resolved via the
 *    documents table; it is therefore not part of the update whitelist.
 */
const PAYMENT_UPDATE_FIELDS = ["status", "paid_at", "amount_sar", "payment_method", "notes"];

const paymentResolver = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await resolveContext();
  requireCapability(ctx, "payments_mutate");
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT id, contract_id FROM contract_payments WHERE id = $1 LIMIT 1`,
    [String((await params).id)]
  );
  const payment = rows?.[0];
  if (!payment) throw new AuthError("غير موجود", 404);
  return assertContractAccess(ctx, String(payment.contract_id));
};

function parseBody(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function pickUpdates(body: Record<string, unknown>) {
  const updates: Record<string, any> = {};
  for (const f of PAYMENT_UPDATE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (body.amount_sar !== undefined) updates.amount_sar = Number(body.amount_sar);
  // Accept "amount" as an alias for amount_sar
  if (body.amount !== undefined && body.amount_sar === undefined) {
    updates.amount_sar = Number(body.amount);
  }
  if (updates.status === "paid" && updates.paid_at === undefined) {
    updates.paid_at = new Date().toISOString();
  }
  return updates;
}

export const GET = withAuth<ContractContext, { id: string }>(
  async (_req, { params }) => {
    const ctx = await resolveContext();
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT contract_id FROM contract_payments WHERE id = $1 LIMIT 1`,
      [String((await params).id)]
    );
    const payment = rows?.[0];
    if (!payment) throw new AuthError("غير موجود", 404);
    return assertContractAccess(ctx, String(payment.contract_id));
  },
  async (ctx, _req, { params }) => {
    const { id } = await params;
    const ds = await getDataSource();
    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .leftJoinAndSelect("cp.contract", "contract")
      .leftJoinAndSelect("contract.contact", "contact")
      .leftJoinAndSelect("contract.unit", "unit")
      .leftJoinAndSelect("contract.property", "property")
      .where("cp.id = :id", { id })
      .getOne();
    if (!payment) throw new AuthError("غير موجود", 404);
    return ok(payment);
  }
);

export const PUT = withAuth<ContractContext, { id: string }>(paymentResolver, async (ctx, req, { params }) => {
  const { id } = await params;
  const body = parseBody(await req.text().catch(() => ""));
  if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

  const ds = await getDataSource();
  const repo = ds.getRepository("ContractPayment");

  const payment = await repo.findOne({ where: { id } as any });
  if (!payment) throw new AuthError("غير موجود", 404);

  const updates = pickUpdates(body as Record<string, unknown>);
  await repo.update(id, updates);

  const shouldBecomePaid = updates.status === "paid";
  let receiptDocument: any | null = null;
  let contract: any | null = null;
  if (shouldBecomePaid) {
    try {
      await ds.query("DELETE FROM documents WHERE category = $1 AND file_name LIKE $2", [
        "payment_receipt",
        `receipt_${id}_%`,
      ]);

      contract = await ds
        .getRepository("Contract")
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.contact", "contact")
        .leftJoinAndSelect("c.property", "property")
        .leftJoinAndSelect("c.unit", "unit")
        .where("c.id = :contractId", { contractId: ctx.contractId })
        .getOne();

      if (contract) {
        // ZATCA invoice: sequential number, unsigned XML, QR (signing added
        // later once ZATCA CSID credentials are available). Never blocks the
        // payment update — failures are logged and skipped.
        let zatcaQR: string | undefined;
        // ZATCA invoices are a Starter+ feature — soft gate: free plans get
        // their receipt WITHOUT the invoice/QR (payment itself never blocks).
        const zatcaAllowed = await hasPlanFeature(ctx.officeId, "zatca");
        if (ctx.officeId && zatcaAllowed) {
          try {
            const [office] = await ds.query(
            `SELECT name, description_ar, vat_number FROM offices WHERE id = $1 LIMIT 1`,
            [ctx.officeId]
          );
          const [contact] = await ds.query(
            `SELECT name FROM contacts WHERE id = $1 LIMIT 1`,
            [(contract as any).contact_id]
          );
          const prevRows = await ds.query(
            `SELECT xml_payload FROM zatca_invoices WHERE office_id = $1 ORDER BY generated_at DESC LIMIT 1`,
            [ctx.officeId]
          );
          const invoiceNumber = await generateInvoiceNumber(ctx.officeId);
          const totalAmount = Number((payment as any).amount_sar) || 0;
          const vatAmount = Math.round(totalAmount * 0.15 * 100) / 100;
          const zatcaData: ZATCAInvoiceData = {
            invoice_number: invoiceNumber,
            invoice_timestamp: new Date().toISOString(),
            seller_name: office?.description_ar ?? office?.name ?? "—",
            seller_vat: office?.vat_number ?? undefined,
            buyer_name: contact?.name ?? "—",
            total_amount: totalAmount,
            vat_amount: vatAmount,
            vat_rate: 0.15,
            payment_method: String((payment as any).payment_method ?? "cash"),
            previous_invoice_hash: prevRows?.[0]?.xml_payload
              ? hashInvoice(String(prevRows[0].xml_payload))
              : undefined,
          };
          const xml = generateZATCAXML(zatcaData);
          const qr = generateZATCAQR(zatcaData);
          zatcaQR = qr;
          await ds.query(
            `INSERT INTO zatca_invoices
               (invoice_number, payment_id, office_id, generated_at, total_amount, vat_amount,
                vat_rate, payment_method, seller_name, seller_vat, buyer_name, buyer_vat,
                xml_payload, qr_payload, previous_invoice_hash, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'generated')`,
            [
              invoiceNumber,
              String(id),
              ctx.officeId,
              zatcaData.invoice_timestamp,
              zatcaData.total_amount,
              zatcaData.vat_amount,
              0.15,
              zatcaData.payment_method,
              zatcaData.seller_name,
              zatcaData.seller_vat ?? null,
              zatcaData.buyer_name,
              zatcaData.buyer_vat ?? null,
              xml,
              qr,
              zatcaData.previous_invoice_hash ?? null,
            ]
          );
          } catch (zatcaErr) {
            console.error("[contract-payments] ZATCA invoice generation failed:", zatcaErr);
          }
        }

        const pdfBytes = await createPaymentReceiptPdfBytes({ contract, payment, zatcaQR });
        // nosemgrep: path-join-resolve-traversal — owner_id is a DB UUID from the
        // ownership-verified contract; the resolved path is guard-checked below.
        const uploadsDir = path.join(process.cwd(), "public", "uploads", String((contract as any).owner_id)); // nosemgrep: path-join-resolve-traversal
        await mkdir(uploadsDir, { recursive: true });
        const contractNumber = contract.extra && typeof contract.extra === "object"
          ? String((contract.extra as { contract_number?: unknown }).contract_number ?? contract.id)
          : contract.id;
        // Keep the `receipt_<paymentId>_` prefix: GET /api/contract-payments parses it
        // (/^receipt_([^_]+)_/) to map payments to receipt URLs. payment.id is the
        // DB-issued UUID. contractNumber comes from contract.extra (user-editable),
        // so sanitize it before using it in a path.
        const safeContractNumber = contractNumber.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
        const fileName = `receipt_${String(id)}_${safeContractNumber}.pdf`;
        // Defense-in-depth: refuse to write outside the upload directory.
        // nosemgrep: path-join-resolve-traversal — fileName is built from the
        // DB-issued payment id and a sanitized contract number (alphanumeric
        // only), so it cannot traverse; the guard below enforces this regardless.
        const filePath = path.resolve(uploadsDir, fileName); // nosemgrep: path-join-resolve-traversal
        // nosemgrep: path-join-resolve-traversal — this is the traversal guard itself.
        if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
          throw new Error("Invalid receipt file path");
        }
        await writeFile(filePath, Buffer.from(pdfBytes));
        const publicUrl = `/uploads/${(contract as any).owner_id}/${fileName}`;
        const docRepo = ds.getRepository("Document");
        receiptDocument = docRepo.create({
          owner_id: (contract as any).owner_id,
          property_id: (contract as any).property_id,
          file_name: fileName,
          mime_type: "application/pdf",
          object_path: filePath,
          public_url: publicUrl,
          size_bytes: pdfBytes.length,
          bucket: "local",
          type: "pdf",
          category: "payment_receipt",
          contract_id: (contract as any).id,
        } as any);
        await docRepo.save(receiptDocument);
        // Notify the property owner (FK-safe: notifications.user_id → users).
        // Tenant channels are future work — the tenant contact id rides in metadata.
        await notifications
          .dispatch({
            type: "payment.received",
            recipientId: String((contract as any).owner_id),
            actorId: ctx.userId,
            officeId: ctx.officeId ?? "",
            priority: "normal",
            channels: [],
            metadata: {
              amount: Number((payment as any).amount_sar) || 0,
              unitNumber: (contract as any).unit?.label ?? "",
              receiptId: String(id),
              contractId: ctx.contractId,
              tenantId: (contract as any).contact_id ?? null,
            },
          })
          .catch(() => {});
      }
    } catch (receiptErr) {
      console.error("[contract-payments] receipt generation failed:", receiptErr);
    }
  }

  const updated = await repo.findOne({ where: { id } as any });
  if (updated) {
    if (!contract) {
      contract = await ds
        .getRepository("Contract")
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.contact", "contact")
        .leftJoinAndSelect("c.property", "property")
        .leftJoinAndSelect("c.unit", "unit")
        .where("c.id = :contractId", { contractId: ctx.contractId })
        .getOne();
    }
    if (contract) {
      await syncRevenueForPayment(contract, updated, ds);
    }
  }
  return ok(receiptDocument ? { payment: updated, receipt: receiptDocument } : updated);
});

export const DELETE = withAuth<ContractContext, { id: string }>(paymentResolver, async (_ctx, _req, { params }) => {
  const { id } = await params;
  const ds = await getDataSource();
  await deleteRevenueForPayment(id, ds);
  await ds.getRepository("ContractPayment").delete(id);
  return ok({ success: true });
});