import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { syncRevenueForPayment, deleteRevenueForPayment } from "@/lib/contract-payment-revenue";
import { createPaymentReceiptPdfBytes } from "@/lib/receipt-pdf";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType !== "agency") return null;
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const rows = await ds.query(
    `SELECT id FROM properties
     WHERE deleted_at IS NULL
       AND (created_by_agency_id = $1 OR owner_id = $1 OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = owner_id
           AND u.created_by_agency_id = $1
           AND u.deleted_at IS NULL
       )
       ${officeId ? "OR EXISTS (SELECT 1 FROM office_property_links l WHERE l.property_id = properties.id AND l.office_id = $2)" : ""}
       )`,
    officeId ? [agencyId, officeId] : [agencyId]
  );
  const ids: string[] = Array.from(new Set((rows ?? []).map((r: any) => String(r.id)).filter(Boolean)));
  return ids.length > 0 ? ids : [];
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const ds = await getDataSource();
    const repo = ds.getRepository("ContractPayment");
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    // If agency has no accessible properties, deny early (avoids IN () SQL error)
    if (Array.isArray(propertyIds) && propertyIds.length === 0) return unauthorized();

    // Verify ownership via contract join
    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "contracts",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .where("cp.id = :id", { id })
      .getOne();

    if (!payment) return unauthorized();

    const updates: Record<string, any> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.status === "paid" && updates.paid_at === undefined) updates.paid_at = new Date().toISOString();
    if (body.paid_at !== undefined) updates.paid_at = body.paid_at;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.amount_sar !== undefined) updates.amount_sar = Number(body.amount_sar);

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
          .where("c.id = :id", { id: (payment as any).contract_id })
          .getOne();

        if (contract) {
          const pdfBytes = await createPaymentReceiptPdfBytes({ contract, payment });
          const uploadsDir = join(process.cwd(), "public", "uploads", String((contract as any).owner_id));
          await mkdir(uploadsDir, { recursive: true });
          const contractNumber = contract.extra && typeof contract.extra === "object"
            ? String((contract.extra as { contract_number?: unknown }).contract_number ?? contract.id)
            : contract.id;
          const fileName = `receipt_${id}_${contractNumber}.pdf`;
          const filePath = join(uploadsDir, fileName);
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
          .where("c.id = :id", { id: (payment as any).contract_id })
          .getOne();
      }
      if (contract) {
        await syncRevenueForPayment(contract, updated, ds);
      }
    }
    return ok(receiptDocument ? { payment: updated, receipt: receiptDocument } : updated);
  } catch (err) {
    console.error("[contract-payments PUT] error:", err);
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const propertyIds = await getAccessiblePropertyIds(ds, user);

    if (Array.isArray(propertyIds) && propertyIds.length === 0) return unauthorized();

    const payment = await ds
      .getRepository("ContractPayment")
      .createQueryBuilder("cp")
      .innerJoin(
        "contracts",
        "c",
        Array.isArray(propertyIds)
          ? "c.id = cp.contract_id AND c.property_id IN (:...propertyIds)"
          : "c.id = cp.contract_id AND c.owner_id = :ownerId",
        Array.isArray(propertyIds) ? { propertyIds } : { ownerId: user.userId }
      )
      .where("cp.id = :id", { id })
      .getOne();

    if (!payment) return unauthorized();

    await deleteRevenueForPayment(id, ds);
    await ds.getRepository("ContractPayment").delete(id);
    return ok({ success: true });
  } catch (err) {
    console.error("[contract-payments DELETE] error:", err);
    return serverError(err);
  }
}
