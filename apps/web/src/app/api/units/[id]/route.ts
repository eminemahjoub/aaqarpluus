export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  assertUnitAccess,
  requireCapability,
  type UnitContext,
} from "@/lib/auth/scope";

/**
 * Units routes — scoped via @/lib/auth/scope.
 * assertUnitAccess already throws AuthError(404) when the unit is missing or
 * the caller has no access, so handlers can rely on ctx.unitId/ctx.propertyId
 * without re-checking existence.
 */
const UNIT_UPDATE_FIELDS = [
  "label",
  "unit_type",
  "floor",
  "area_sqm",
  "rent_amount",
  "status",
  "description",
  "last_ac_service_date",
  "last_plumbing_check_date",
  "last_electrical_check_date",
  "maintenance_risk_score",
  "maintenance_risk_level",
];

export const GET = withAuth<UnitContext, { id: string }>(
  async (_req, { params }) =>
    assertUnitAccess(await resolveContext(), String((await params).id)),
  async (ctx) => {
    const ds = await getDataSource();
    const unit = await ds.getRepository("Unit").findOne({
      where: { id: ctx.unitId },
      relations: ["property", "owner"],
    });
    const contracts = await ds
      .getRepository("Contract")
      .find({ where: { unit_id: ctx.unitId } as any, order: { start_date: "DESC" } as any });
    return ok({ data: { ...unit, contracts } });
  }
);

const mutateResolver = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await resolveContext();
  requireCapability(ctx, "properties_mutate");
  return assertUnitAccess(ctx, String((await params).id));
};

function parseBody(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function pickUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const f of UNIT_UPDATE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  // Accept area_m2 as alias for area_sqm (existing behavior)
  if (body.area_m2 !== undefined && body.area_sqm === undefined) {
    updates.area_sqm = body.area_m2;
  }
  return updates;
}

export const PUT = withAuth<UnitContext, { id: string }>(mutateResolver, async (ctx, req) => {
  const body = parseBody(await req.text().catch(() => ""));
  if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

  const ds = await getDataSource();
  const updates = pickUpdates(body as Record<string, unknown>);
  await ds.getRepository("Unit").update(ctx.unitId, updates);
  const updated = await ds.getRepository("Unit").findOne({ where: { id: ctx.unitId } });
  return ok(updated);
});

// PATCH kept for existing frontend consumers (useBuilding.ts, ServiceLogForm.tsx)
export const PATCH = withAuth<UnitContext, { id: string }>(mutateResolver, async (ctx, req) => {
  const body = parseBody(await req.text().catch(() => ""));
  if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

  const ds = await getDataSource();
  const updates = pickUpdates(body as Record<string, unknown>);
  await ds.getRepository("Unit").update(ctx.unitId, updates);
  const updated = await ds.getRepository("Unit").findOne({ where: { id: ctx.unitId } });
  return ok(updated);
});

export const DELETE = withAuth<UnitContext, { id: string }>(mutateResolver, async (ctx) => {
  const ds = await getDataSource();
  await ds.getRepository("Unit").delete(ctx.unitId);
  return ok({ success: true });
});