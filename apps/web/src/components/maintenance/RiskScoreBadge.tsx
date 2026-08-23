"use client";

export type RiskLevel = "low" | "medium" | "high" | "critical";

const STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const LABELS: Record<RiskLevel, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

export function RiskScoreBadge({ score, level, className = "" }: { score: number; level: string; className?: string }) {
  const lvl = (STYLES[level as RiskLevel] ? level : "low") as RiskLevel;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STYLES[lvl]} ${className}`}
      title={`درجة الخطورة: ${score}/100`}
    >
      <span className="tabular-nums">{score}</span>
      <span aria-hidden>/100</span>
      <span className="opacity-80">·</span>
      {LABELS[lvl]}
    </span>
  );
}
