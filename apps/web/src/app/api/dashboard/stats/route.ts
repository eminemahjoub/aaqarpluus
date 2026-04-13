import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { expandOccurrencesInRange } from "@/lib/recurring-tasks";
import { getAccessibleOwnerIds } from "@/lib/office-scope";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ?? String(new Date().getFullYear());
    const monthStr = searchParams.get("month"); // YYYY-MM for calendar data

    const ds = await getDataSource();
    const ownerIds = await getAccessibleOwnerIds(ds, user);
    if (ownerIds.length === 0) {
      return ok({
        monthly: [],
        totalUnits: 0,
        occupiedUnits: 0,
        totalContracts: 0,
        activeContracts: 0,
        pendingPayments: [],
        monthPayments: [],
        calendarData: { tasks: [], revenues: [], expenses: [], contracts: [], monthPayments: [] },
      });
    }

    // Monthly income & expenses
    const monthlyRaw = await ds.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', r.received_at), 'YYYY-MM-01') AS month,
        COALESCE(SUM(r.amount_sar), 0) AS income_sar,
        0 AS expenses_sar,
        COALESCE(SUM(r.amount_sar), 0) AS net_sar
      FROM revenues r
      WHERE r.owner_id = ANY($1)
        AND EXTRACT(YEAR FROM r.received_at) = $2
      GROUP BY DATE_TRUNC('month', r.received_at)
      UNION ALL
      SELECT
        TO_CHAR(DATE_TRUNC('month', e.paid_at), 'YYYY-MM-01') AS month,
        0 AS income_sar,
        COALESCE(SUM(e.amount_sar), 0) AS expenses_sar,
        -COALESCE(SUM(e.amount_sar), 0) AS net_sar
      FROM expenses e
      WHERE e.owner_id = ANY($1)
        AND EXTRACT(YEAR FROM e.paid_at) = $2
      GROUP BY DATE_TRUNC('month', e.paid_at)
      `,
      [ownerIds, Number(year)]
    );

    // Aggregate by month
    const monthMap: Record<string, { income_sar: number; expenses_sar: number; net_sar: number }> = {};
    for (const row of monthlyRaw) {
      const m = String(row.month).slice(0, 10);
      if (!monthMap[m]) monthMap[m] = { income_sar: 0, expenses_sar: 0, net_sar: 0 };
      monthMap[m].income_sar += Number(row.income_sar) || 0;
      monthMap[m].expenses_sar += Number(row.expenses_sar) || 0;
      monthMap[m].net_sar += Number(row.net_sar) || 0;
    }
    const monthly = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

    // Occupancy
    const occupancyRaw = await ds.query(
      `
      SELECT
        COUNT(*) AS total_units,
        COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_units
      FROM units
      WHERE owner_id = ANY($1)
      `,
      [ownerIds]
    );
    const totalUnits = Number(occupancyRaw[0]?.total_units) || 0;
    const occupiedUnits = Number(occupancyRaw[0]?.occupied_units) || 0;

    // Pending/overdue payments
    const pendingPayments = await ds.query(
      `
      SELECT
        cp.id, cp.amount_sar, cp.due_date, cp.status,
        c.contact_id, c.property_id, c.unit_id,
        p.name AS property_name,
        u.label AS unit_label
      FROM contract_payments cp
      JOIN contracts c ON c.id = cp.contract_id
      LEFT JOIN properties p ON p.id = c.property_id
      LEFT JOIN units u ON u.id = c.unit_id
      WHERE c.owner_id = ANY($1)
        AND cp.status != 'paid'
      ORDER BY cp.due_date ASC
      LIMIT 20
      `,
      [ownerIds]
    );

    // Get tenant names
    const contactIds = [...new Set(pendingPayments.map((r: any) => r.contact_id).filter(Boolean))];
    let contactMap: Record<string, string> = {};
    if (contactIds.length > 0) {
      const contacts = await ds.query(
        `SELECT id, name FROM contacts WHERE id = ANY($1)`,
        [contactIds]
      );
      contactMap = Object.fromEntries(contacts.map((c: any) => [c.id, c.name]));
    }

    // Contract counts
    const contractCountRaw = await ds.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active FROM contracts WHERE owner_id = ANY($1)`,
      [ownerIds]
    );
    const totalContracts = Number(contractCountRaw[0]?.total) || 0;
    const activeContracts = Number(contractCountRaw[0]?.active) || 0;

    // Current month collections
    const now = new Date();
    const monthStart = monthStr
      ? `${monthStr}-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const monthPayments = await ds.query(
      `
      SELECT cp.id, cp.amount_sar, cp.due_date, cp.paid_at, cp.status,
             ct.name AS contact_name
      FROM contract_payments cp
      JOIN contracts c ON c.id = cp.contract_id
      LEFT JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.owner_id = ANY($1)
        AND cp.due_date >= $2
        AND cp.due_date < $3
      ORDER BY cp.due_date ASC
      `,
      [ownerIds, monthStart, monthEnd]
    );

    // Calendar marks — include recurring (مهام ثابتة) on every matching day in the month
    const tasksRaw = monthStr
      ? await ds.query(
          `SELECT id, title, due_date, extra FROM tasks WHERE owner_id = ANY($1) AND due_date IS NOT NULL AND due_date < $3`,
          [ownerIds, monthStart, monthEnd]
        )
      : [];
    const tasks: Array<{ id: string; title: string; due_date: string }> = [];
    if (monthStr) {
      for (const t of tasksRaw as any[]) {
        const ymds = expandOccurrencesInRange(
          t.due_date ? String(t.due_date).slice(0, 10) : null,
          t.extra,
          monthStart.slice(0, 10),
          monthEnd.slice(0, 10),
        );
        const seen = new Set<string>();
        for (const ymd of ymds) {
          const k = `${t.id}:${ymd}`;
          if (seen.has(k)) continue;
          seen.add(k);
          tasks.push({ id: String(t.id), title: String(t.title ?? "مهمة"), due_date: ymd });
        }
      }
    }

    const revenues = monthStr
      ? await ds.query(
          `SELECT id, type, received_at FROM revenues WHERE owner_id = ANY($1) AND received_at >= $2 AND received_at < $3`,
          [ownerIds, monthStart, monthEnd]
        )
      : [];

    const expenses = monthStr
      ? await ds.query(
          `SELECT id, type, paid_at FROM expenses WHERE owner_id = ANY($1) AND paid_at >= $2 AND paid_at < $3`,
          [ownerIds, monthStart, monthEnd]
        )
      : [];

    const contracts = monthStr
      ? await ds.query(
          `SELECT id, start_date, end_date FROM contracts WHERE owner_id = ANY($1)
           AND (start_date >= $2 AND start_date < $3 OR end_date >= $2 AND end_date < $3)`,
          [ownerIds, monthStart, monthEnd]
        )
      : [];

    return ok({
      monthly,
      totalUnits,
      occupiedUnits,
      totalContracts,
      activeContracts,
      pendingPayments: pendingPayments.map((r: any) => ({
        ...r,
        tenantName: contactMap[r.contact_id] ?? "—",
      })),
      monthPayments,
      calendarData: { tasks, revenues, expenses, contracts, monthPayments },
    });
  } catch (err) {
    return serverError(err);
  }
}
