export const dynamic = "force-dynamic";
import { getDataSource } from "@/lib/db/data-source";
import { jsonResponse } from "@/lib/errors";
import {
  withAuth,
  resolveContext,
  assertPropertyAccess,
  type UserContext,
} from "@/lib/auth/scope";
import { logAudit } from "@/lib/audit";
import { assertPlanFeature } from "@/lib/billing/enforce";

/**
 * GET /api/properties/[id]/tenant-pii — unmasked tenant PII for the
 * property's active contract.
 *
 * SECURITY: the owner gate lives here, server-side, and ONLY here.
 *  - access: assertPropertyAccess (404 for missing/unauthorized)
 *  - owner: property.owner_id must equal the caller's user id → else 403
 *  - no-store headers: never cached
 *
 * Contacts carry no id_expiry column — that field is intentionally absent.
 */
export const GET = withAuth<UserContext, { id: string }>(
  async (_req, { params }) => {
    const ctx = await resolveContext();
    void params;
    return ctx;
  },
  async (ctx, _req, { params }) => {
    const { id } = await params;
    const ds = await getDataSource();

    await assertPropertyAccess(ctx, id);

    const props = await ds.query(
      `SELECT owner_id FROM properties WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    const property = props?.[0];
    if (!property) return jsonResponse({ error: "غير موجود", code: "NOT_FOUND" }, 404);

    if (String(property.owner_id) !== String(ctx.userId)) {
      return jsonResponse({ error: "ممنوع", code: "FORBIDDEN" }, 403);
    }

    // owner_portal is a Growth+ feature — gate the managing office's plan.
    const off = await ds.query(
      `SELECT COALESCE(p.managing_office_id, (SELECT office_id FROM users WHERE id = p.owner_id), NULL) AS office_id
         FROM properties p WHERE p.id = $1 LIMIT 1`,
      [id]
    );
    const gateOffice = off?.[0]?.office_id ? String(off[0].office_id) : null;
    if (gateOffice) {
      await assertPlanFeature(gateOffice, "owner_portal");
    }

    const rows = await ds.query(
      `SELECT ct.id, ct.name, ct.phone, ct.email, ct.id_number
         FROM contracts c
         JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.property_id = $1
          AND c.status = 'active'
          AND c.deleted_at IS NULL
          AND ct.deleted_at IS NULL
        ORDER BY c.start_date DESC
        LIMIT 1`,
      [id]
    );
    const contact = rows?.[0];
    if (!contact) {
      return jsonResponse({ error: "لا يوجد مستأجر نشط", code: "NOT_FOUND" }, 404);
    }

    // Compliance: every unmask is audited (who, which property, when).
    void logAudit({
      userId: ctx.userId,
      action: "tenant-pii.unmask",
      entityType: "property",
      entityId: id,
      metadata: { contactId: String(contact.id) },
      req: _req,
    });

    return new Response(
      JSON.stringify({
        id: String(contact.id),
        name: contact.name ?? null,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
        id_number: contact.id_number ?? null,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
);