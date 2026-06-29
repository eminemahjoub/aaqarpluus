export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { ok, created } from "@/lib/api-helpers";
import { assertSuperAdmin } from "@/lib/admin-guard";
import { badRequest, handleError } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import { badZod } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

const CreateUserSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(["owner", "agency", "superadmin"]).default("owner"),
  password: z.string().min(6),
  office_id: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    await assertSuperAdmin(req);
    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);
    const page = parsePagination(searchParams) ?? { page: 1, limit: 25, offset: 0, search: null };
    const search = page.search ?? null;
    const role = searchParams.get("role");
    const status = searchParams.get("status"); // active|inactive

    let qb = ds
      .getRepository("User")
      .createQueryBuilder("u")
      .where("u.deleted_at IS NULL")
      .orderBy("u.created_at", "DESC");

    if (role && ["owner", "agency", "superadmin"].includes(role)) qb = qb.andWhere("u.user_type = :role", { role });
    if (status === "active") qb = qb.andWhere("u.is_active = true");
    if (status === "inactive") qb = qb.andWhere("u.is_active = false");
    if (search) {
      qb = qb.andWhere("(u.full_name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q)", { q: `%${search}%` });
    }

    const [rows, total] = await qb.skip(page.offset).take(page.limit).getManyAndCount();

    // attach stats (counts) in batch
    const userIds = rows.map((r: any) => String(r.id)).filter(Boolean);
    let counts: Record<string, { properties: number; units: number; contracts: number }> = {};
    if (userIds.length) {
      const props = await ds.query(
        `SELECT owner_id, COUNT(*)::int AS c FROM properties WHERE deleted_at IS NULL AND owner_id = ANY($1) GROUP BY owner_id`,
        [userIds]
      );
      const units = await ds.query(
        `SELECT owner_id, COUNT(*)::int AS c FROM units WHERE deleted_at IS NULL AND owner_id = ANY($1) GROUP BY owner_id`,
        [userIds]
      );
      const contracts = await ds.query(
        `SELECT owner_id, COUNT(*)::int AS c FROM contracts WHERE deleted_at IS NULL AND owner_id = ANY($1) GROUP BY owner_id`,
        [userIds]
      );
      for (const r of props ?? []) counts[String(r.owner_id)] = { properties: Number(r.c) || 0, units: 0, contracts: 0 };
      for (const r of units ?? []) (counts[String(r.owner_id)] ||= { properties: 0, units: 0, contracts: 0 }).units = Number(r.c) || 0;
      for (const r of contracts ?? [])
        (counts[String(r.owner_id)] ||= { properties: 0, units: 0, contracts: 0 }).contracts = Number(r.c) || 0;
    }

    const items = rows.map((u: any) => ({
      id: String(u.id),
      full_name: u.full_name ?? null,
      email: String(u.email),
      phone: u.phone ?? null,
      role: String(u.user_type),
      is_active: Boolean(u.is_active),
      created_at: u.created_at ?? null,
      office_id: u.office_id ?? null,
      stats: counts[String(u.id)] ?? { properties: 0, units: 0, contracts: 0 },
    }));

    return ok(paginated({ items, total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await assertSuperAdmin(req);
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));
    const ds = await getDataSource();
    const repo = ds.getRepository("User");

    const exists = await repo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = :email", { email: parsed.data.email.toLowerCase() })
      .andWhere("u.deleted_at IS NULL")
      .getOne();
    if (exists) throw badRequest("هذا البريد الإلكتروني مسجل مسبقاً");

    const password_hash = await bcrypt.hash(parsed.data.password, 10);
    const user = repo.create({
      email: parsed.data.email.toLowerCase(),
      password_hash,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      user_type: parsed.data.role,
      office_id: parsed.data.role === "agency" ? parsed.data.office_id ?? null : null,
      is_active: true,
    } as any);
    await repo.save(user);

    logAudit({
      userId: (me as any).userId,
      action: "create",
      entityType: "user",
      entityId: String((user as any).id),
      metadata: { role: parsed.data.role },
      req,
    });

    return created({ id: (user as any).id });
  } catch (err) {
    return handleError(err);
  }
}

