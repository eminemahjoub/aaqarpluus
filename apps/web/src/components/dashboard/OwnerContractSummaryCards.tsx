"use client";

import type { OwnerContractSummary } from "@/lib/owner-tenant-privacy";
import { formatDaysUntilAr } from "@/lib/owner-tenant-privacy";

export function OwnerContractSummaryCards({
  summary,
  compact = false,
}: {
  summary: OwnerContractSummary | null | undefined;
  compact?: boolean;
}) {
  if (!summary) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">لا يوجد عقد نشط</p>;
  }

  const pad = compact ? "p-3" : "p-4";
  const endLabel = formatDaysUntilAr(summary.days_until_contract_end, "يتبقى");
  const rentDaysLabel = formatDaysUntilAr(summary.days_until_next_rent_due, "يتبقى");
  const nextAmount =
    summary.next_rent_amount_sar != null
      ? `${summary.next_rent_amount_sar.toLocaleString("ar-SA")} ر.س`
      : null;

  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
      <div
        className={`rounded-xl border border-indigo-100 bg-indigo-50/80 ${pad} dark:border-indigo-900/40 dark:bg-indigo-950/20`}
      >
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">انتهاء العقد / التجديد</p>
        <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">{endLabel}</p>
        {summary.end_date !== "—" ? (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">حتى {summary.end_date}</p>
        ) : null}
      </div>
      <div
        className={`rounded-xl border border-amber-100 bg-amber-50/80 ${pad} dark:border-amber-900/40 dark:bg-amber-950/20`}
      >
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">تحصيل الإيجار</p>
        {nextAmount ? (
          <>
            <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">{rentDaysLabel}</p>
            <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">مبلغ {nextAmount}</p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">لا توجد دفعة مستحقة</p>
        )}
        {summary.rent_remaining_sar > 0 ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            إجمالي المتبقي للتحصيل: {summary.rent_remaining_sar.toLocaleString("ar-SA")} ر.س
          </p>
        ) : null}
      </div>
    </div>
  );
}
