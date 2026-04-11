/** Helpers for tasks with extra.recurrence (مهام ثابتة). */

export type RecurrenceRule = "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseYmd(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  const s = String(ymd).slice(0, 10).replace(/\//g, "-");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return null;
  return startOfDay(dt);
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dd}`;
}

export function stepRecurrence(d: Date, rule: string): Date {
  const x = new Date(d);
  switch (rule) {
    case "daily":
      x.setDate(x.getDate() + 1);
      break;
    case "weekly":
      x.setDate(x.getDate() + 7);
      break;
    case "monthly":
      x.setMonth(x.getMonth() + 1);
      break;
    case "quarterly":
      x.setMonth(x.getMonth() + 3);
      break;
    case "yearly":
      x.setFullYear(x.getFullYear() + 1);
      break;
    default:
      return x;
  }
  return startOfDay(x);
}

function readRecurrence(extra: unknown): RecurrenceRule | "none" {
  const r = (extra as { recurrence?: string } | null)?.recurrence;
  const allowed: RecurrenceRule[] = ["none", "daily", "weekly", "monthly", "quarterly", "yearly"];
  return allowed.includes(r as RecurrenceRule) ? (r as RecurrenceRule) : "none";
}

/** True if this task (anchor date + optional recurrence) falls on the given calendar day. */
export function occursOnCalendarDay(
  task: { date: string; extra?: { recurrence?: string } | null | undefined },
  day: Date,
): boolean {
  const target = startOfDay(day);
  const anchor = parseYmd(task.date);
  if (!anchor) return false;
  let ex: unknown = task.extra;
  if (typeof ex === "string") {
    try {
      ex = JSON.parse(ex) as object;
    } catch {
      ex = null;
    }
  }
  const rec = readRecurrence(ex);
  if (rec === "none") {
    return +startOfDay(anchor) === +target;
  }
  if (+anchor > +target) return false;
  let cur = new Date(anchor);
  let guard = 0;
  while (cur < target && guard++ < 2500) {
    cur = stepRecurrence(cur, rec);
  }
  return +startOfDay(cur) === +target;
}

/**
 * All YYYY-MM-DD occurrences in [rangeStart, rangeEnd) for a DB task row.
 * rangeEnd is exclusive (e.g. first day of next month).
 */
export function expandOccurrencesInRange(
  dueDate: string | null | undefined,
  extra: unknown,
  rangeStartYmd: string,
  rangeEndYmd: string,
): string[] {
  let ex = extra;
  if (typeof ex === "string") {
    try {
      ex = JSON.parse(ex) as object;
    } catch {
      ex = null;
    }
  }
  const anchor = parseYmd(dueDate ?? undefined);
  if (!anchor) return [];
  const rs = parseYmd(rangeStartYmd);
  const re = parseYmd(rangeEndYmd);
  if (!rs || !re) return [];
  const rec = readRecurrence(ex);
  const out: string[] = [];

  if (rec === "none") {
    if (+anchor >= +rs && +anchor < +re) out.push(formatYmd(anchor));
    return out;
  }

  let cur = new Date(anchor);
  let guard = 0;
  while (cur < rs && guard++ < 2500) {
    cur = stepRecurrence(cur, rec);
  }
  guard = 0;
  while (cur < re && guard++ < 2500) {
    out.push(formatYmd(cur));
    cur = stepRecurrence(cur, rec);
  }
  return out;
}
