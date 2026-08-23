export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok } from "@/lib/api-helpers";
import { jsonResponse, AppError } from "@/lib/errors";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { processPendingNotifications } from "@/lib/notifications";

/**
 * POST /api/notifications/process — admin-only manual drain of the
 * notification_queue (also runs on a 5-minute interval via the processor).
 */
export async function POST(req: NextRequest) {
  try {
    await assertSuperAdmin(req); // throws 401/403 for non-superadmins
    void getDataSource();
    const result = await processPendingNotifications();
    return ok(result);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    console.error("[notifications/process] error:", err);
    return jsonResponse({ error: "خطأ في الخادم", code: "INTERNAL" }, 500);
  }
}