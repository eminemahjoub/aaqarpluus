import type { DataSource } from "typeorm";
import type { JwtPayload } from "@/lib/auth";

/** المالك والحساب الشخصي — لا يظهر اسم/جوال المستأجر ولا جدول السداد التفصيلي. */
export function ownerHidesTenantPii(user: Pick<JwtPayload, "userType"> | null | undefined) {
  const t = String(user?.userType ?? "");
  return t === "owner" || t === "personal";
}

export type OwnerContractSummary = {
  unit_label: string;
  start_date: string;
  end_date: string;
  days_until_contract_end: number | null;
  days_until_next_rent_due: number | null;
  next_rent_amount_sar: number | null;
  rent_remaining_sar: number;
};

export function parseYmd(s: string | null | undefined): Date | null {
  if (!s || s === "—") return null;
  const d = new Date(`${String(s).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(from: Date, to: Date): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysUntilAr(days: number | null, prefix = "يتبقى"): string {
  if (days === null) return "—";
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return "اليوم";
  return `${prefix} ${days} يوم`;
}

type PaymentLike = { due_date?: string | null; amount_sar?: number | string | null; status?: string | null };

export function buildOwnerContractSummary(opts: {
  end_date?: string | null;
  start_date?: string | null;
  unit_label?: string | null;
  payments?: PaymentLike[];
}): OwnerContractSummary {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDate = parseYmd(opts.end_date);
  const days_until_contract_end = endDate ? daysUntil(today, endDate) : null;

  const unpaid = (opts.payments ?? [])
    .filter((p) => String(p.status ?? "") !== "paid")
    .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")));

  let rent_remaining_sar = 0;
  for (const p of unpaid) {
    rent_remaining_sar += Number(p.amount_sar) || 0;
  }

  const next = unpaid[0];
  const nextDue = next ? parseYmd(next.due_date) : null;
  const days_until_next_rent_due = nextDue ? daysUntil(today, nextDue) : null;
  const next_rent_amount_sar = next ? Number(next.amount_sar) || null : null;

  return {
    unit_label: opts.unit_label ? String(opts.unit_label) : "—",
    start_date: opts.start_date ? String(opts.start_date).slice(0, 10) : "—",
    end_date: opts.end_date ? String(opts.end_date).slice(0, 10) : "—",
    days_until_contract_end,
    days_until_next_rent_due,
    next_rent_amount_sar,
    rent_remaining_sar,
  };
}

export async function paymentsByContractId(ds: DataSource, contractIds: string[]): Promise<Record<string, PaymentLike[]>> {
  if (contractIds.length === 0) return {};
  const payments = await ds
    .getRepository("ContractPayment")
    .createQueryBuilder("cp")
    .where("cp.contract_id IN (:...contractIds)", { contractIds })
    .orderBy("cp.due_date", "ASC")
    .getMany();
  const map: Record<string, PaymentLike[]> = {};
  for (const p of payments) {
    const cid = String((p as { contract_id?: string }).contract_id ?? "");
    if (!cid) continue;
    (map[cid] ||= []).push(p as PaymentLike);
  }
  return map;
}

export function sanitizeContractForOwner(contract: Record<string, unknown>, payments?: PaymentLike[]): Record<string, unknown> {
  const unit = contract.unit as { label?: string } | undefined;
  const summary = buildOwnerContractSummary({
    end_date: contract.end_date as string | null,
    start_date: contract.start_date as string | null,
    unit_label: unit?.label ?? null,
    payments,
  });
  const { contact: _c, ...rest } = contract;
  return {
    ...rest,
    contact: null,
    contact_id: undefined,
    owner_contract_summary: summary,
  };
}

/**
 * Removes PIN material (hash/plaintext) from a contact row before it leaves
 * the API, exposing only a `pin_set` boolean so UIs can show "login enabled".
 */
export function stripPinSecrets(contact: Record<string, unknown>): Record<string, unknown> {
  const { pin_hash, pin_plain: _pinPlain, ...rest } = contact;
  return { ...rest, pin_set: Boolean(pin_hash) };
}

export function sanitizeContactForOwner(contact: Record<string, unknown>): Record<string, unknown> {
  if (String(contact.type ?? "") !== "tenant") return contact;
  return {
    ...contact,
    name: "مستأجر",
    phone: null,
    alternative_phone: null,
  };
}

export function sanitizePaymentRowForOwner(row: Record<string, unknown>): Record<string, unknown> {
  const { contact_name: _n, contact_phone: _p, tenantName: _t, ...rest } = row;
  return rest;
}
