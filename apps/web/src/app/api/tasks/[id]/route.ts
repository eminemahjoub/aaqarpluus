export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  assertTaskAccess,
  requireCapability,
  AuthError,
  type TaskContext,
} from "@/lib/auth/scope";
import { notifications } from "@/lib/notifications";

/**
 * Tasks routes — scoped via @/lib/auth/scope.
 * assertTaskAccess handles both unit-level and property-level (unit_id NULL,
 * e.g. building-wide maintenance) tasks, throwing AuthError(404) on missing
 * or unauthorized. ctx.unitId may be null for property-level tasks.
 *
 * Before/after photos live in task.extra (attachments_before/attachments_after)
 * and are surfaced as task.photos on GET.
 */
const TASK_UPDATE_FIELDS = [
  "type",
  "priority",
  "status",
  "title",
  "description",
  "due_date",
  "due_date_hijri",
  "cost_sar",
  "assigned_to",
  "sla_deadline",
  "materials_cost",
  "materials",
  "property_id",
  "unit_id",
  "contact_id",
  "tenant_id",
  "extra",
];

const taskResolver = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await resolveContext();
  requireCapability(ctx, "tasks_mutate");
  return assertTaskAccess(ctx, String((await params).id));
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
  for (const f of TASK_UPDATE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  return updates;
}

async function loadTaskWithDetails(id: string) {
  const ds = await getDataSource();
  return ds
    .getRepository("Task")
    .createQueryBuilder("t")
    .leftJoinAndSelect("t.property", "property")
    .leftJoinAndSelect("t.unit", "unit")
    .leftJoinAndSelect("t.contact", "contact")
    .leftJoinAndSelect("t.tenant", "tenant")
    .leftJoinAndSelect("t.assignedTo", "assignedTo")
    .where("t.id = :id", { id })
    .getOne();
}

export const GET = withAuth<TaskContext, { id: string }>(
  async (_req, { params }) =>
    assertTaskAccess(await resolveContext(), String((await params).id)),
  async (ctx) => {
    const task = await loadTaskWithDetails(ctx.taskId);
    if (!task) throw new AuthError("غير موجود", 404);
    const extra = (task as any).extra && typeof (task as any).extra === "object" ? (task as any).extra : {};
    return ok({
      ...task,
      photos: {
        before: Array.isArray(extra.attachments_before) ? extra.attachments_before : [],
        after: Array.isArray(extra.attachments_after) ? extra.attachments_after : [],
      },
    });
  }
);

export const PUT = withAuth<TaskContext, { id: string }>(taskResolver, async (ctx, req) => {
  const body = parseBody(await req.text().catch(() => ""));
  if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

  const ds = await getDataSource();
  const before = await ds.getRepository("Task").findOne({ where: { id: ctx.taskId } as any });
  const previousAssignee = before ? (before as any).assigned_to : null;

  const updates = pickUpdates(body as Record<string, unknown>);
  await ds.getRepository("Task").update(ctx.taskId, updates as any);

  // Notify the newly assigned member when the assignee changes.
  const newAssignee = updates.assigned_to != null ? String(updates.assigned_to) : null;
  if (newAssignee && newAssignee !== String(previousAssignee ?? "")) {
    // Resolve the tenant (contact) on the task's unit for the tenant channel
    let tenantId: string | null = null;
    if (ctx.unitId) {
      const contractRows = await ds.query(
        `SELECT contact_id FROM contracts
          WHERE unit_id = $1 AND status = 'active' AND deleted_at IS NULL
          LIMIT 1`,
        [ctx.unitId]
      );
      tenantId = contractRows?.[0]?.contact_id ? String(contractRows[0].contact_id) : null;
    }
    await notifications
      .dispatch({
        type: "maintenance.assigned",
        recipientId: newAssignee,
        actorId: ctx.userId,
        officeId: ctx.officeId ?? "",
        priority: "high",
        channels: [],
        metadata: {
          taskId: ctx.taskId,
          unitNumber: String((before as any)?.extra?.unit_label ?? ""),
          issue: String((before as any)?.title ?? body.title ?? ""),
          priority: String(updates.priority ?? "medium"),
          tenantId,
        },
      })
      .catch(() => {});
  }

  return ok(await loadTaskWithDetails(ctx.taskId));
});

export const DELETE = withAuth<TaskContext, { id: string }>(taskResolver, async (ctx) => {
  const ds = await getDataSource();
  await ds.getRepository("Task").delete(ctx.taskId);
  return ok({ success: true });
});