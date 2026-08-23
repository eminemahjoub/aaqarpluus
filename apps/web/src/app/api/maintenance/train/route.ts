export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { trainMaintenanceModel, invalidateModelCache } from "@/lib/maintenance/model";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();
    if (String(user.userType ?? "") !== "superadmin") return unauthorized();

    const result = await trainMaintenanceModel();
    invalidateModelCache();

    await logAudit({
      userId: user.userId,
      action: "maintenance_model.train",
      entityType: "maintenance_model",
      metadata: result,
      req,
    });

    if (!result.trained) {
      return ok({ trained: false, reason: result.reason ?? null });
    }

    return ok({
      trained: true,
      version: result.model.version,
      samples: result.model.samples,
      metrics: result.model.metrics,
    });
  } catch (err) {
    return serverError(err);
  }
}
