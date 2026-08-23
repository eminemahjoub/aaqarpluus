export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

async function getAccessiblePropertyIds(ds: any, user: any): Promise<string[] | null> {
  const userType = String(user.userType ?? "");
  if (userType === "superadmin") return null;
  if (userType !== "agency") {
    return ds
      .query(`SELECT id FROM properties WHERE deleted_at IS NULL AND owner_id = $1`, [String(user.userId)])
      .then((rows: any[]) => rows.map((r) => String(r.id)));
  }
  const agencyId = String(user.userId);
  const officeId = user.officeId ? String(user.officeId) : null;
  const officeClause = officeId
    ? `OR EXISTS (SELECT 1 FROM office_property_links l WHERE l.property_id = p.id AND l.office_id = $2)`
    : "";
  const params: any[] = [agencyId];
  if (officeId) params.push(officeId);
  const rows = await ds.query(
    `SELECT p.id FROM properties p
     WHERE p.deleted_at IS NULL
       AND (p.created_by_agency_id = $1 OR p.owner_id = $1 ${officeClause})`,
    params
  );
  return Array.from(new Set((rows ?? []).map((r: any) => String(r.id))));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("MaintenancePrediction");

    const prediction = await repo.findOne({ where: { id } as any });
    if (!prediction) return unauthorized();

    // Scope check: prediction must belong to a unit in a property the user can access
    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const unitRow = await ds.query(`SELECT property_id FROM units WHERE id = $1 LIMIT 1`, [
      String((prediction as any).unit_id),
    ]);
    const pid = unitRow?.[0]?.property_id ? String(unitRow[0].property_id) : null;
    if (Array.isArray(propertyIds) && (propertyIds.length === 0 || (pid && !propertyIds.includes(pid)))) {
      return unauthorized();
    }

    await repo.update(id, { is_resolved: true, resolved_at: new Date() } as any);

    // Mark linked task (created from the AI) as done
    const linked = await ds.query(
      `SELECT id FROM tasks WHERE deleted_at IS NULL AND extra->>'prediction_id' = $1 LIMIT 1`,
      [String(id)]
    );
    if (linked?.[0]?.id) {
      await ds.query(`UPDATE tasks SET status = 'done', updated_at = NOW() WHERE id = $1`, [String(linked[0].id)]);
    }

    await logAudit({
      userId: user.userId,
      action: "maintenance_prediction.resolve",
      entityType: "maintenance_prediction",
      entityId: String(id),
      metadata: { unit_id: (prediction as any).unit_id },
      req,
    });

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
