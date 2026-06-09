import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";

export async function GET() {
  const health = {
    status: "ok" as "ok" | "degraded" | "error",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {} as Record<string, { status: "ok" | "error"; latencyMs: number; message?: string }>,
  };

  // Database check
  const dbStart = Date.now();
  try {
    const ds = await getDataSource();
    await ds.query("SELECT 1");
    health.checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    health.status = "error";
    health.checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      message: err instanceof Error ? err.message : "Unknown DB error",
    };
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return jsonResponse(health, statusCode);
}
