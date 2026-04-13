"use client";

import Link from "next/link";
import * as React from "react";
import { AgencyDashboard } from "@/components/dashboard/AgencyDashboard";
import { OwnerHomeDashboard } from "@/components/dashboard/OwnerHomeDashboard";

export default function AgencyHome() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (!cancelled) setAllowed(false);
          return;
        }
        const me = await res.json();
        if (!cancelled) setAllowed(String(me?.userType ?? "") === "agency");
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) return null;
  if (!allowed) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة تحكم المكتب</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">نظرة سريعة على أداء جميع الملاك المرتبطين</p>
        </div>
      </div>

      <AgencyDashboard showHeader={false} />

      <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 backdrop-blur-sm dark:border-emerald-800/30 dark:bg-[#102318]/50">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">إجراءات سريعة</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/agency/owners"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-gray-50 dark:border dark:border-emerald-800/30 dark:bg-[#132a1f] dark:hover:bg-[#1a3528]"
        >
          <div className="text-lg font-semibold text-gray-900 dark:text-white">الملاك</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">ربط/فك ربط ملاك بالمكتب</div>
        </Link>
        <Link
          href="/agency/members"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-gray-50 dark:border dark:border-emerald-800/30 dark:bg-[#132a1f] dark:hover:bg-[#1a3528]"
        >
          <div className="text-lg font-semibold text-gray-900 dark:text-white">الموظفين</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">إضافة/إدارة مستخدمين داخل المكتب</div>
        </Link>
        <Link
          href="/agency/properties"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-gray-50 dark:border dark:border-emerald-800/30 dark:bg-[#132a1f] dark:hover:bg-[#1a3528]"
        >
          <div className="text-lg font-semibold text-gray-900 dark:text-white">العقارات</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">إدارة عقارات الملاك المرتبطين</div>
        </Link>
      </div>
      </div>

      <OwnerHomeDashboard showHeader={false} showStatsCards={false} />
    </div>
  );
}

