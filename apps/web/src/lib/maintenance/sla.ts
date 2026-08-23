/**
 * SLA deadline calculation for maintenance tasks.
 * Priority → hours: low=72h, medium=48h, high=24h, urgent=4h.
 */
const SLA_HOURS: Record<string, number> = {
  low: 72,
  medium: 48,
  high: 24,
  urgent: 4,
};

export function calculateSLADeadline(priority: string | null | undefined): Date {
  const hours = (priority ? SLA_HOURS[String(priority).toLowerCase()] : undefined) ?? 48;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function slaHoursRemaining(deadline: string | Date | null | undefined): number | null {
  if (!deadline) return null;
  const target = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(target.getTime())) return null;
  return (target.getTime() - Date.now()) / (60 * 60 * 1000);
}