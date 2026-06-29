export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import { badZod } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

const CreateSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["free", "basic", "premium", "enterprise"]).default("free"),
  status: z.enum(["active", "expired", "cancelled", "trial"]).default("active"),
  start_date: z.string().min(4),
  end_date: z.string().optional().nullable(),
  max_properties: z.number().int().min(0).optional(),
  max_units: z.number().int().min(0).optional(),
  max_users: z.number().int().min(0).optional(),
  price: z.number().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await assertSuperAdmin(req);
    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);
    const page = parsePagination(searchParams) ?? { page: 1, limit: 25, offset: 0, search: null };
    const search = page.search ?? null;
    const status = searchParams.get("status");
    const plan = searchParams.get("plan");

    const params: any[] = [];
    let idx = 1;
    let where = "WHERE 1=1";
    if (status && ["active", "expired", "cancelled", "trial"].includes(status)) {
      where += ` AND s.status = $${idx++}`;
      params.push(status);
    }
    if (plan && ["free", "basic", "premium", "enterprise"].includes(plan)) {
      where += ` AND s.plan = $${idx++}`;
      params.push(plan);
    }
    if (search) {
      where += ` AND (u.email ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const totalRows = await ds.query(
      `SELECT COUNT(*)::int AS total FROM subscriptions s JOIN users u ON u.id = s.user_id ${where}`,
      params
    );
    const total = Number(totalRows?.[0]?.total ?? 0) || 0;

    params.push(page.limit, page.offset);
    const rows = await ds.query(
      `
      SELECT
        s.id, s.user_id, u.email AS user_email, u.full_name AS user_name,
        s.plan, s.status, s.start_date, s.end_date, s.price,
        s.max_properties, s.max_units, s.max_users,
        s.created_at, s.updated_at
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      ${where}
      ORDER BY s.updated_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      params
    );

    // Basic revenue stats (sum price where active/trial)
    const revenueRaw = await ds.query(
      `SELECT COALESCE(SUM(price), 0)::numeric AS revenue FROM subscriptions WHERE status IN ('active','trial')`
    );

    const activeRaw = await ds.query(`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status = 'active'`);
    const expiredRaw = await ds.query(`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status = 'expired'`);

    return ok({
      ...paginated({ items: rows ?? [], total, page: page.page, limit: page.limit, search }),
      stats: {
        revenue_active: Number(revenueRaw?.[0]?.revenue ?? 0) || 0,
        active: Number(activeRaw?.[0]?.c ?? 0) || 0,
        expired: Number(expiredRaw?.[0]?.c ?? 0) || 0,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await assertSuperAdmin(req);
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const repo = ds.getRepository("Subscription");
    const sub = repo.create({
      user_id: parsed.data.user_id,
      plan: parsed.data.plan,
      status: parsed.data.status,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date ?? null,
      max_properties: parsed.data.max_properties ?? 5,
      max_units: parsed.data.max_units ?? 20,
      max_users: parsed.data.max_users ?? 1,
      price: parsed.data.price ?? 0,
    } as any);
    await repo.save(sub);

    logAudit({
      userId: (me as any).userId,
      action: "create",
      entityType: "subscription",
      entityId: String((sub as any).id),
      metadata: { user_id: parsed.data.user_id, plan: parsed.data.plan, status: parsed.data.status },
      req,
    });

    return created({ id: (sub as any).id });
  } catch (err) {
    return handleError(err);
  }
}

