export function parseYmdToDateLocal(ymd: string): Date | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function hijriYmdFromDate(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function hijriYmdFromGregorianYmd(ymd: string): string {
  const dt = parseYmdToDateLocal(ymd);
  if (!dt) return "";
  return hijriYmdFromDate(dt);
}

export function hijriYmdFromIsoDateTime(iso: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return hijriYmdFromDate(dt);
}

