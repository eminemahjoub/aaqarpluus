import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import {
  getUserFromRequest,
  unauthorized,
  created,
  serverError,
  badRequest,
} from "@/lib/api-helpers";
import { z } from "zod";
import { badZod } from "@/lib/validation";

const CreateBuildingSchema = z.object({
  name: z.string().trim().min(1, "اسم المبنى مطلوب"),
  address: z.string().trim().min(1, "العنوان مطلوب"),
  floors_count: z.number().int().min(1, "عدد الطوابق يجب أن يكون 1 على الأقل"),
  apartments_per_floor: z.number().int().min(0).default(0),
  shops_count: z.number().int().min(0).default(0),
  shops_per_floor: z.boolean().default(false),
  property_model_type: z.enum(["residential", "commercial", "mixed"]),
  owner_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType) !== "agency") return unauthorized();

    const officeId = user.officeId ? String(user.officeId) : null;
    const agencyId = String(user.userId);

    const body = await req.json();
    const parsed = CreateBuildingSchema.safeParse(body);
    if (!parsed.success) return badRequest(badZod(parsed.error));
    const data = parsed.data;

    const ds = await getDataSource();
    const propertyRepo = ds.getRepository("Property");
    const unitRepo = ds.getRepository("Unit");

    let ownerId: string | undefined;
    if (data.owner_id) {
      ownerId = data.owner_id;
      // Verify owner is linked to this agency (if officeId exists) or created by agency
      if (officeId) {
        const linked = await ds.query(
          "SELECT 1 AS ok FROM office_owner_links WHERE office_id = $1 AND owner_id = $2 LIMIT 1",
          [officeId, ownerId]
        );
        if (!Array.isArray(linked) || linked.length === 0) {
          return badRequest("المالك غير مرتبط بهذا المكتب");
        }
      } else {
        const owner = await ds
          .getRepository("User")
          .findOne({ where: { id: ownerId, created_by_agency_id: agencyId } as any });
        if (!owner) return badRequest("المالك غير موجود");
      }
    }

    // Compute totals
    const totalApartments = data.apartments_per_floor * data.floors_count;
    const totalShops = data.shops_per_floor
      ? data.shops_count * data.floors_count
      : data.shops_count;
    const totalUnits = totalApartments + totalShops;

    // Create property (building)
    const property = propertyRepo.create({
      owner_id: ownerId ?? agencyId,
      managing_office_id: officeId,
      name: data.name,
      address: data.address,
      property_model_type: data.property_model_type,
      floors_count: data.floors_count,
      apartments_count: totalApartments,
      shops_count: totalShops,
      units_count: totalUnits,
      status: "vacant",
    } as any);

    await propertyRepo.save(property);
    const propertyId = String((property as any).id);

    // Auto-generate units
    const units: any[] = [];

    // Apartments: B{floor}-A{number}
    for (let floor = 1; floor <= data.floors_count; floor++) {
      for (let apt = 1; apt <= data.apartments_per_floor; apt++) {
        const unit = unitRepo.create({
          property_id: propertyId,
          owner_id: ownerId ?? agencyId,
          label: `B${floor}-A${apt}`,
          unit_type: "appartement",
          floor: String(floor),
          status: "vacant",
        } as any);
        await unitRepo.save(unit);
        units.push(unit);
      }
    }

    // Shops: B{floor}-M{number}
    if (data.shops_per_floor) {
      for (let floor = 1; floor <= data.floors_count; floor++) {
        for (let shop = 1; shop <= data.shops_count; shop++) {
          const unit = unitRepo.create({
            property_id: propertyId,
            owner_id: ownerId ?? agencyId,
            label: `B${floor}-M${shop}`,
            unit_type: "magasin",
            floor: String(floor),
            status: "vacant",
          } as any);
          await unitRepo.save(unit);
          units.push(unit);
        }
      }
    } else if (data.shops_count > 0) {
      // All shops on ground floor (étage 0)
      for (let shop = 1; shop <= data.shops_count; shop++) {
        const unit = unitRepo.create({
          property_id: propertyId,
          owner_id: ownerId ?? agencyId,
          label: `B0-M${shop}`,
          unit_type: "magasin",
          floor: "0",
          status: "vacant",
        } as any);
        await unitRepo.save(unit);
        units.push(unit);
      }
    }

    if (officeId) {
      const linkOwnerId = ownerId ?? agencyId;
      await ds.query(
        `INSERT INTO office_property_links (office_id, owner_id, property_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [officeId, linkOwnerId, propertyId]
      );
    }

    return created({
      property: { ...(property as any), units },
      units_generated: units.length,
    });
  } catch (err) {
    return serverError(err);
  }
}
