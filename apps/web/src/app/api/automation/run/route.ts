export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { notifications } from "@/lib/notifications";

/**
 * POST /api/automation/run
 * Runs automation rules for the current agency/user.
 * - Marks contracts as "expired" when end_date has passed
 * - Frees units when their contract expires
 * - Creates tasks for contracts expiring within 30 days
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const userType = String(user.userType ?? "");
    if (userType !== "agency") return unauthorized();

    const ds = await getDataSource();
    const agencyId = String(user.userId);
    const today = new Date().toISOString().split("T")[0];

    const results: Record<string, number> = {};

    // 1. Mark expired contracts
    const expiredUpdate = await ds.query(
      `UPDATE contracts
       SET status = 'expired',
           updated_at = NOW()
       WHERE status = 'active'
         AND end_date IS NOT NULL
         AND end_date < $1
         AND property_id IN (
           SELECT id FROM properties p
           WHERE p.deleted_at IS NULL
             AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
               SELECT 1 FROM users u
               WHERE u.id = p.owner_id
                 AND u.created_by_agency_id = $2
                 AND u.deleted_at IS NULL
             ))
         )`,
      [today, agencyId]
    );
    results.expiredContracts = expiredUpdate?.[1] ?? 0;

    // 2. Free units whose active contract just expired
    const freedUnits = await ds.query(
      `UPDATE units u
       SET status = 'available',
           updated_at = NOW()
       WHERE u.status = 'occupied'
         AND u.deleted_at IS NULL
         AND u.property_id IN (
           SELECT id FROM properties p
           WHERE p.deleted_at IS NULL
             AND (p.created_by_agency_id = $1 OR p.owner_id = $1 OR EXISTS (
               SELECT 1 FROM users ux
               WHERE ux.id = p.owner_id
                 AND ux.created_by_agency_id = $1
                 AND ux.deleted_at IS NULL
             ))
         )
         AND NOT EXISTS (
           SELECT 1 FROM contracts c
           WHERE c.unit_id = u.id
             AND c.status = 'active'
             AND c.deleted_at IS NULL
         )`,
      [agencyId]
    );
    results.freedUnits = freedUnits?.[1] ?? 0;

    // 3. Create tasks for contracts expiring within 30 days (avoid duplicates)
    const expiringSoon = await ds.query(
      `SELECT c.id AS contract_id,
              c.contact_id,
              c.property_id,
              c.unit_id,
              c.end_date
       FROM contracts c
       JOIN properties p ON p.id = c.property_id
       WHERE c.status = 'active'
         AND c.deleted_at IS NULL
         AND c.end_date IS NOT NULL
         AND c.end_date > $1
         AND c.end_date <= ($1::date + INTERVAL '30 days')::text
         AND p.deleted_at IS NULL
         AND (p.created_by_agency_id = $2 OR p.owner_id = $2 OR EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = p.owner_id
             AND u.created_by_agency_id = $2
             AND u.deleted_at IS NULL
         ))`,
      [today, agencyId]
    );

    const taskRepo = ds.getRepository("Task");
    let tasksCreated = 0;
    for (const row of expiringSoon ?? []) {
      const contractId = String(row.contract_id);
      const existingTask = await ds.query(
        `SELECT 1 FROM tasks
         WHERE related_contract_id = $1
           AND title LIKE 'تجديد العقد%'
           AND deleted_at IS NULL
         LIMIT 1`,
        [contractId]
      );
      if (existingTask?.[0]) continue;

      const endDateStr = String(row.end_date ?? "");
      const task = taskRepo.create({
        owner_id: agencyId,
        property_id: row.property_id ?? null,
        unit_id: row.unit_id ?? null,
        related_contract_id: contractId,
        title: `تجديد العقد المنتهي بتاريخ ${endDateStr}`,
        description: `العقد ينتهي بتاريخ ${endDateStr}. يجب التواصل مع المستأجر للتجديد أو تسليم العقار.`,
        status: "pending",
        priority: "high",
        due_date: endDateStr,
        assigned_to: null,
      } as any);
      await taskRepo.save(task);
      tasksCreated++;
      // Notify the agency on every newly detected 30-day expiry
      await notifications
        .dispatch({
          type: "contract.renewal_due",
          recipientId: agencyId,
          actorId: agencyId,
          officeId: user.officeId ? String(user.officeId) : "",
          priority: "high",
          channels: [],
          metadata: {
            contractId,
            expiryDate: endDateStr,
            unitNumber: String(row.unit_id ?? ""),
          },
        })
        .catch(() => {});
    }
    results.tasksCreated = tasksCreated;

    return ok({ success: true, today, results, message: "اكتملت عمليات التشغيل التلقائي" });
  } catch (err) {
    return serverError(err);
  }
}
