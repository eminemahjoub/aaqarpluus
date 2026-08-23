import type { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromCookies } from "@/lib/api-helpers";
import { AppError, jsonResponse } from "@/lib/errors";
import { canMutateProperties, canMutateAppData } from "@/lib/permissions";
import { ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";

/**
 * Scope/auth helpers for API routes.
 *
 * Consolidated replacement for the copy-pasted auth checks that previously
 * lived inline in ~8 route handlers.
 *
 * Design notes (adapted from a Supabase-oriented spec to the actual stack):
 *  - Auth source: custom JWT cookies via `getUserFromCookies()`
 *    (equivalent to `getUserFromRequest(req)` — cookies, then verified JWT).
 *  - There is no `office_members` table; roles/office come from `users`
 *    (`user_type`, `office_id`).
 *  - `users.user_type` is mapped to the `Role` union below (least privilege
 *    on unknown values).
 *  - Contracts in this schema carry `property_id`/`unit_id`/`owner_id`
 *    directly (no `units!inner(...)` join needed); `unit_id` is nullable.
 */

export type Role = "owner" | "admin" | "manager" | "agent" | "viewer";

export interface UserContext {
  userId: string;
  email: string | null;
  /** Raw value from users.user_type (superadmin|agency|owner|personal). */
  userType: string;
  /** Derived from user_type — see ROLE_BY_USER_TYPE. */
  role: Role;
  officeId: string | null;
}

export type PropertyContext = UserContext & { propertyId: string };
export type UnitContext = PropertyContext & { unitId: string };
export type ContractContext = UserContext & {
  propertyId: string | null;
  unitId: string | null;
  contractId: string;
};
export type TaskContext = UserContext & {
  propertyId: string;
  unitId: string | null;
  taskId: string;
};

export type RouteContext<P extends Record<string, string>> = { params: Promise<P> };

/** Error with an HTTP status; handled by withAuth / the app's handleError. */
export class AuthError extends AppError {
  constructor(message: string, status: 401 | 403 | 404 = 401) {
    super({
      message,
      status,
      code:
        status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : "NOT_FOUND",
    });
    this.name = "AuthError";
  }
}

const ROLE_BY_USER_TYPE: Record<string, Role> = {
  superadmin: "admin",
  agency: "manager",
  owner: "owner",
  personal: "owner",
};

export function roleFromUserType(userType: string): Role {
  return ROLE_BY_USER_TYPE[userType] ?? "viewer";
}

/**
 * Resolves the current user from the auth cookie and loads authoritative
 * role/office data from the `users` table.
 *
 * @param officeId if provided, the user must belong to that office (403 otherwise).
 * @throws AuthError(401) when unauthenticated, unknown, or inactive.
 * @throws AuthError(403) when the optional office_id does not match.
 */
export async function resolveContext(officeId?: string | null): Promise<UserContext> {
  const user = await getUserFromCookies();
  if (!user) throw new AuthError("غير مصرح", 401);

  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT id, email, user_type, office_id, is_active
       FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [String(user.userId)]
  );
  const row = rows?.[0];
  if (!row || row.is_active === false) throw new AuthError("غير مصرح", 401);

  const resolvedOfficeId = row.office_id != null ? String(row.office_id) : null;
  if (officeId && resolvedOfficeId !== officeId) {
    throw new AuthError("ممنوع", 403);
  }

  return {
    userId: String(row.id),
    email: row.email != null ? String(row.email) : null,
    userType: String(row.user_type ?? ""),
    role: roleFromUserType(String(row.user_type ?? "")),
    officeId: resolvedOfficeId,
  };
}

/**
 * IDOR-safe property access check.
 * Throws AuthError(404) both when the property does not exist and when the
 * user has no access, so existence cannot be probed.
 */
export async function assertPropertyAccess(
  ctx: UserContext,
  propertyId: string
): Promise<PropertyContext> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [propertyId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthError("غير موجود", 404);
  }
  if (!(await hasPropertyAccess(ds, ctx, propertyId))) {
    throw new AuthError("غير موجود", 404);
  }
  return { ...ctx, propertyId };
}

/** Unit -> property -> office chain. Same 404 semantics as assertPropertyAccess. */
export async function assertUnitAccess(
  ctx: UserContext,
  unitId: string
): Promise<UnitContext> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT id, property_id FROM units WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [unitId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthError("غير موجود", 404);
  }
  const propertyId = rows[0].property_id != null ? String(rows[0].property_id) : null;
  if (!propertyId) throw new AuthError("غير موجود", 404);
  if (!(await hasPropertyAccess(ds, ctx, propertyId))) {
    throw new AuthError("غير موجود", 404);
  }
  return { ...ctx, propertyId, unitId };
}

/**
 * Contract -> property -> office chain. Same 404 semantics.
 * Owners pass when they own the contract; offices pass via property access.
 */
export async function assertContractAccess(
  ctx: UserContext,
  contractId: string
): Promise<ContractContext> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT c.id, c.property_id, c.unit_id, c.owner_id
       FROM contracts c
      WHERE c.id = $1 AND c.deleted_at IS NULL
      LIMIT 1`,
    [contractId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthError("غير موجود", 404);
  }
  const row = rows[0];
  const propertyId = row.property_id != null ? String(row.property_id) : null;
  const unitId = row.unit_id != null ? String(row.unit_id) : null;

  const ownerOwnsContract =
    ctx.role === "owner" &&
    row.owner_id != null &&
    String(row.owner_id) === ctx.userId;

  if (!ownerOwnsContract) {
    if (!propertyId) throw new AuthError("غير موجود", 404);
    if (!(await hasPropertyAccess(ds, ctx, propertyId))) {
      throw new AuthError("غير موجود", 404);
    }
  }

  return { ...ctx, propertyId, unitId, contractId };
}

/**
 * Assert access to a task.
 * Handles both unit-level tasks (via assertUnitAccess) and property-level
 * tasks (via assertPropertyAccess) when unit_id is NULL — e.g. building-wide
 * maintenance (HVAC, elevators, common areas).
 * Same 404 semantics: missing task, orphan task, or no access.
 */
export async function assertTaskAccess(
  ctx: UserContext,
  taskId: string
): Promise<TaskContext> {
  const ds = await getDataSource();
  const rows = await ds.query(
    `SELECT unit_id, property_id FROM tasks WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [taskId]
  );
  const task = rows?.[0];
  if (!task) throw new AuthError("غير موجود", 404);

  if (task.unit_id != null) {
    const unitCtx = await assertUnitAccess(ctx, String(task.unit_id));
    return { ...unitCtx, unitId: String(task.unit_id), taskId };
  }

  if (task.property_id != null) {
    const propCtx = await assertPropertyAccess(ctx, String(task.property_id));
    return { ...propCtx, unitId: null, taskId };
  }

  // Orphan task (no unit_id, no property_id) — should not exist, 404 safely.
  throw new AuthError("غير موجود", 404);
}

/** Throws AuthError(403) unless ctx.role is one of the given roles. */
export function requireRole(ctx: UserContext, ...roles: Role[]): UserContext {
  if (!roles.includes(ctx.role)) {
    throw new AuthError("ممنوع", 403);
  }
  return ctx;
}

export type Capability =
  | "properties_mutate"
  | "contracts_mutate"
  | "payments_mutate"
  | "tasks_mutate"
  | "finance_mutate"
  | "documents_mutate"
  | "app_data";

/**
 * Delegates to the existing capability map in lib/permissions.ts.
 * `properties_mutate` requires an agency; `app_data` allows agency/owner/personal;
 * `contracts_mutate` follows the legacy mutate-guard semantics (agency/superadmin
 * only — owners/personal are read-only on tenant contracts, see ownerHidesTenantPii);
 * `tasks_mutate`/`payments_mutate`/`finance_mutate` match the legacy route behavior
 * (any authenticated app user with access: agency/owner/personal/admin).
 */
export function requireCapability(
  ctx: UserContext,
  capability: Capability
): UserContext {
  const ok =
    capability === "properties_mutate"
      ? canMutateProperties({ userType: ctx.userType })
      : capability === "contracts_mutate"
        ? !ownerHidesTenantPii({ userType: ctx.userType })
        : capability === "tasks_mutate" ||
            capability === "payments_mutate" ||
            capability === "finance_mutate" ||
            capability === "documents_mutate"
          ? ctx.role === "admin" || canMutateAppData({ userType: ctx.userType })
          : canMutateAppData({ userType: ctx.userType });
  if (!ok) throw new AuthError("ممنوع", 403);
  return ctx;
}

/**
 * Property ids visible to this context, for list endpoints.
 * - null: unrestricted (admin)
 * - []: no access — callers should return empty results
 * Mirrors the legacy office-scope rules: office users via
 * office_property_links (or created-by/owner fallback without an office),
 * owners via direct ownership.
 */
export async function getPropertyIdsForContext(
  ctx: UserContext
): Promise<string[] | null> {
  const ds = await getDataSource();
  if (ctx.role === "admin") return null;
  if (ctx.role === "viewer") return [];

  if (ctx.role === "owner") {
    const rows = await ds.query(
      `SELECT id FROM properties WHERE owner_id = $1 AND deleted_at IS NULL`,
      [ctx.userId]
    );
    return (rows ?? []).map((r: any) => String(r.id)).filter(Boolean);
  }

  if (!ctx.officeId) {
    const rows = await ds.query(
      `SELECT p.id
         FROM properties p
        WHERE p.deleted_at IS NULL
          AND (
            p.created_by_agency_id = $1
            OR p.owner_id = $1
            OR EXISTS (
              SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = $1
                 AND u.deleted_at IS NULL
            )
          )`,
      [ctx.userId]
    );
    return (rows ?? []).map((r: any) => String(r.id)).filter(Boolean);
  }

  const rows = await ds.query(
    `SELECT property_id FROM office_property_links WHERE office_id = $1`,
    [ctx.officeId]
  );
  return (rows ?? []).map((r: any) => String(r.property_id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Access internals
// ---------------------------------------------------------------------------

/**
 * Mirror of the legacy inline scoping rules (see lib/office-scope.ts):
 *  - admin bypasses.
 *  - owners/personal must own the property.
 *  - office staff: access via office_property_links, or (agency without an
 *    office) via created-by/owner-created-by-agency relations.
 */
async function hasPropertyAccess(
  ds: DataSource,
  ctx: UserContext,
  propertyId: string
): Promise<boolean> {
  if (ctx.role === "admin") return true;
  if (ctx.role === "viewer") return false;

  if (ctx.role === "owner") {
    const rows = await ds.query(
      `SELECT 1 AS ok FROM properties
        WHERE id = $1 AND deleted_at IS NULL AND owner_id = $2
        LIMIT 1`,
      [propertyId, ctx.userId]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  if (!ctx.officeId) {
    const rows = await ds.query(
      `SELECT 1 AS ok
         FROM properties p
        WHERE p.id = $1 AND p.deleted_at IS NULL
          AND (
            p.created_by_agency_id = $2
            OR p.owner_id = $2
            OR EXISTS (
              SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = $2
                 AND u.deleted_at IS NULL
            )
          )
        LIMIT 1`,
      [propertyId, ctx.userId]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  const rows = await ds.query(
    `SELECT 1 AS ok FROM office_property_links
      WHERE office_id = $1 AND property_id = $2
      LIMIT 1`,
    [ctx.officeId, propertyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

// ---------------------------------------------------------------------------
// Route wrapper
// ---------------------------------------------------------------------------

/**
 * HOF wrapping a Next.js route handler with an auth/scope resolver.
 * Catches AuthError (and other AppErrors) and returns JSON {error, code}
 * with the correct status; non-AppErrors are rethrown for the route's own
 * error handling (or a 500 from Next).
 *
 * Usage:
 *   export const GET = withAuth(
 *     async (_req, { params }) =>
 *       assertContractAccess(await resolveContext(), String((await params).contract_id)),
 *     async (ctx, req) => ok({ contractId: ctx.contractId })
 *   );
 */
export function withAuth<
  C extends UserContext,
  P extends Record<string, string> = Record<string, string>,
>(
  resolver: (req: NextRequest, routeCtx: RouteContext<P>) => Promise<C>,
  handler: (ctx: C, req: NextRequest, routeCtx: RouteContext<P>) => Promise<Response>
): (req: NextRequest, routeCtx: RouteContext<P>) => Promise<Response> {
  return async (req, routeCtx) => {
    try {
      const ctx = await resolver(req, routeCtx);
      return await handler(ctx, req, routeCtx);
    } catch (err) {
      if (err instanceof AppError) {
        return jsonResponse(
          {
            error: err.message,
            code: err.code,
            ...(err.details !== undefined ? { details: err.details } : {}),
          },
          err.status
        );
      }
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Convenience presets
// ---------------------------------------------------------------------------

/** withAuth preset resolving context + property access from a route `id` param. */
export function withPropertyAccess<
  P extends Record<string, string> = Record<string, string>,
>(
  handler: (ctx: PropertyContext, req: NextRequest, routeCtx: RouteContext<P>) => Promise<Response>
) {
  return withAuth<PropertyContext, P>(async (_req, routeCtx) => {
    const { id } = await routeCtx.params;
    return assertPropertyAccess(await resolveContext(), id);
  }, handler);
}

/** withAuth preset resolving context + unit access from a route `id` param. */
export function withUnitAccess<P extends Record<string, string> = Record<string, string>>(
  handler: (ctx: UnitContext, req: NextRequest, routeCtx: RouteContext<P>) => Promise<Response>
) {
  return withAuth<UnitContext, P>(async (_req, routeCtx) => {
    const { id } = await routeCtx.params;
    return assertUnitAccess(await resolveContext(), id);
  }, handler);
}

/** withAuth preset resolving context + contract access from a route `id` param. */
export function withContractAccess<
  P extends Record<string, string> = Record<string, string>,
>(
  handler: (ctx: ContractContext, req: NextRequest, routeCtx: RouteContext<P>) => Promise<Response>
) {
  return withAuth<ContractContext, P>(async (_req, routeCtx) => {
    const { id } = await routeCtx.params;
    return assertContractAccess(await resolveContext(), id);
  }, handler);
}