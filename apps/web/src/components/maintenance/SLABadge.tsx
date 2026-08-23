"use client";

import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { slaHoursRemaining } from "@/lib/maintenance/sla";

function formatHours(hours: number): string {
  const rounded = Math.abs(Math.round(hours));
  return `${rounded.toLocaleString("ar-SA")} ساعة`;
}

/**
 * SLA badge for a maintenance task.
 *  - completed/cancelled: red "تجاوز SLA" when completed past the deadline,
 *    green "مكتمل ضمن SLA" when completedAt is known and within SLA,
 *    null otherwise.
 *  - active: red breached (متجاوز بـ X ساعة), amber < 4h left, blue otherwise.
 */
export function SLABadge({
  deadline,
  status,
  completedAt,
}: {
  deadline: string | null;
  status: string;
  completedAt?: string | null;
}) {
  if (!deadline) return null;

  const finished = status === "completed" || status === "cancelled";
  if (finished) {
    if (!completedAt) return null;
    const done = new Date(completedAt).getTime();
    const target = new Date(deadline).getTime();
    if (Number.isNaN(done) || Number.isNaN(target)) return null;
    if (done > target) {
      return (
        <Badge variant="red">
          <AlertTriangle className="h-3.5 w-3.5" />
          تجاوز SLA
        </Badge>
      );
    }
    return (
      <Badge variant="green">
        <CheckCircle className="h-3.5 w-3.5" />
        مكتمل ضمن SLA
      </Badge>
    );
  }

  const remaining = slaHoursRemaining(deadline);
  if (remaining === null) return null;

  if (remaining < 0) {
    return (
      <Badge variant="red">
        <AlertTriangle className="h-3.5 w-3.5" />
        متجاوز بـ {formatHours(remaining)} ساعة
      </Badge>
    );
  }
  if (remaining < 4) {
    return (
      <Badge variant="amber">
        <Clock className="h-3.5 w-3.5" />
        {formatHours(remaining)} ساعة متبقية
      </Badge>
    );
  }
  return (
    <Badge variant="blue">
      <Clock className="h-3.5 w-3.5" />
      {formatHours(remaining)} ساعة متبقية
    </Badge>
  );
}

function Badge({
  variant,
  children,
}: {
  variant: "red" | "green" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        styles[variant]
      )}
    >
      {children}
    </span>
  );
}