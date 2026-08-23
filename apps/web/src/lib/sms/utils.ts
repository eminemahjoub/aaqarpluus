/** True for network/rate/5xx-ish failures that merit a retry. */
export function isSMSRetryable(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return /timeout|timed out|etimedout|fetch failed|network|429|rate|5\d\d|temporarily/i.test(msg);
}

/** +966... / 05... / 5... → E.164 (+9665XXXXXXXX). Throws for non-Saudi. */
export function normalizeSaudiNumber(to: string): string {
  let p = String(to).replace(/[\s\-()]/g, "");
  if (p.startsWith("+966")) p = p.slice(4).replace(/^0/, "");
  else if (p.startsWith("00966")) p = p.slice(5).replace(/^0/, "");
  else if (p.startsWith("966")) p = p.slice(3).replace(/^0/, "");
  else if (p.startsWith("0")) p = p.slice(1);
  if (!/^5\d{8}$/.test(p)) throw new Error("Non-Saudi number");
  return `+966${p}`;
}