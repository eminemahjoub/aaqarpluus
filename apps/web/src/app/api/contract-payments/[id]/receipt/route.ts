import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, serverError } from "@/lib/api-helpers";
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const contract = await ds
      .getRepository("Contract")
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.contact", "contact")
      .leftJoinAndSelect("c.property", "property")
      .leftJoinAndSelect("c.unit", "unit")
      .where("c.id = :id", { id: (payment as any).contract_id })
      .getOne();

    if (!contract) return unauthorized();

    const pdfBytes = await createPaymentReceiptPdfBytes({ contract, payment });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt_${id}.pdf"`,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
