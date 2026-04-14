"use client";

import * as React from "react";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={["animate-pulse rounded-xl bg-gray-100 dark:bg-[#132a1f]", className].filter(Boolean).join(" ")} />;
}

export function PageLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-8 w-56" />
        <LoadingSkeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  title = "صار خطأ",
  message = "تعذّر تحميل البيانات.",
  actionLabel = "إعادة المحاولة",
  onRetry,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-xs opacity-90">{message}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-[#132a1f] dark:text-red-200 dark:hover:bg-red-950/30"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

