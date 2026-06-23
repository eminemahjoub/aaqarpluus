import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, serverError } from "@/lib/api-helpers";
import { generateReceiptHtml, type ReceiptData } from "@/lib/receipt-template";

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

async function getCompanyInfo(ds: any, user: any): Promise<ReceiptData["company"]> {
  const userType = String(user.userType ?? "");

  const envCompany = {
    nameAr: process.env.COMPANY_NAME_AR ?? "اسم الشركة",
    nameEn: process.env.COMPANY_NAME_EN ?? "Company Name",
    descAr: process.env.COMPANY_DESC_AR ?? "للمقاولات والخدمات العقارية",
    descEn: process.env.COMPANY_DESC_EN ?? "For Contracting & Real Estate Services",
    phone: process.env.COMPANY_PHONE ?? "05XXXXXXXX",
    cr: process.env.COMPANY_CR ?? "XXXXXXXXXX",
    vat: process.env.COMPANY_VAT ?? "3XXXXXXXXXXXXXX",
    addressAr: process.env.COMPANY_ADDRESS_AR ?? "العنوان هنا - حي - المدينة",
    addressEn: process.env.COMPANY_ADDRESS_EN ?? "Your Address Here - District - City",
    logoUrl: process.env.COMPANY_LOGO_URL ?? null,
  };

  if (userType === "agency") {
    try {
      const agencyId = String(user.userId);
      const userRow = await ds.query(
        `SELECT u.full_name, u.phone, o.name AS office_name, o.phone AS office_phone, o.address AS office_address
         FROM users u
         LEFT JOIN offices o ON o.id = u.office_id
         WHERE u.id = $1`,
        [agencyId]
      );
      if (userRow && userRow.length > 0) {
        const row = userRow[0];
        return {
          nameAr: row.office_name ?? row.full_name ?? envCompany.nameAr,
          nameEn: envCompany.nameEn,
          descAr: envCompany.descAr,
          descEn: envCompany.descEn,
          phone: row.office_phone ?? row.phone ?? envCompany.phone,
          cr: envCompany.cr,
          vat: envCompany.vat,
          addressAr: row.office_address ?? envCompany.addressAr,
          addressEn: envCompany.addressEn,
          logoUrl: envCompany.logoUrl,
        };
      }
    } catch {
      // fall through to env defaults
    }
  }

  if (userType === "owner") {
    try {
      const userRow = await ds.query(
        `SELECT full_name, phone FROM users WHERE id = $1`,
        [String(user.userId)]
      );
      if (userRow && userRow.length > 0) {
        const row = userRow[0];
        return {
          nameAr: row.full_name ?? envCompany.nameAr,
          nameEn: envCompany.nameEn,
          descAr: envCompany.descAr,
          descEn: envCompany.descEn,
          phone: row.phone ?? envCompany.phone,
          cr: envCompany.cr,
          vat: envCompany.vat,
          addressAr: envCompany.addressAr,
          addressEn: envCompany.addressEn,
          logoUrl: envCompany.logoUrl,
        };
      }
    } catch {
      // fall through to env defaults
    }
  }

  return envCompany;
}

async function generateReceiptNumber(ds: any, paymentId: string): Promise<string> {
  try {
    const rows = await ds.query(
      `SELECT COUNT(*) + 1 AS seq FROM contract_payments WHERE created_at <= (SELECT created_at FROM contract_payments WHERE id = $1)`,
      [paymentId]
    );
    if (rows && rows.length > 0) {
      return String(rows[0].seq).padStart(4, "0");
    }
  } catch {
    // fall through
  }
  return paymentId.slice(0, 4).toUpperCase();
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

    const company = await getCompanyInfo(ds, user);
    const receiptNumber = await generateReceiptNumber(ds, id);

    const html = generateReceiptHtml({
      payment,
      contract,
      receiptNumber,
      company,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("[receipt route] error:", err);
    return serverError(err);
  }
}
