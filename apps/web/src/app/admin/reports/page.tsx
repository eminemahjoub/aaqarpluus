"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

function MiniBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#0b1220]">
      <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

export default function AdminReportsPage() {
  const q = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/reports");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل التقارير");
      }
      return res.json() as any;
    },
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const d = q.data!;
  const maxCity = Math.max(1, ...(d.topCities ?? []).map((x: any) => Number(x.count) || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">التقارير</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">ملخص عام عن نمو المنصة + النشاط + الإيرادات.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/30">
          <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">الإيرادات الإجمالية</div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-900 dark:text-white">
            {Number(d.totalRevenueSar ?? 0) || 0} SAR
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/30">
          <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">نسبة الإشغال الكلية</div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-900 dark:text-white">
            {Number(d.occupancy?.occupancyRatePercent ?? 0) || 0}%
          </div>
          <div className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-200/80">
            {Number(d.occupancy?.occupiedUnits ?? 0) || 0} / {Number(d.occupancy?.totalUnits ?? 0) || 0}
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/30">
          <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">أكثر الملاك عقارات</div>
          <div className="mt-2 space-y-2">
            {(d.topOwners ?? []).slice(0, 5).map((o: any) => (
              <div key={o.owner_id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs dark:bg-[#0b1220]">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{o.full_name ?? o.email}</span>
                <span className="font-extrabold text-indigo-700 dark:text-indigo-200">{Number(o.properties_count) || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220]">
          <div className="mb-3 text-sm font-bold text-gray-900 dark:text-white">أكثر المدن نشاطاً</div>
          <div className="space-y-2">
            {(d.topCities ?? []).map((r: any) => (
              <div key={r.city} className="flex items-center gap-3">
                <div className="w-20 truncate text-xs text-gray-600 dark:text-gray-300">{r.city}</div>
                <div className="flex-1">
                  <MiniBar percent={((Number(r.count) || 0) / maxCity) * 100} />
                </div>
                <div className="w-10 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">{Number(r.count) || 0}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220]">
          <div className="mb-3 text-sm font-bold text-gray-900 dark:text-white">نمو (آخر 12 شهر)</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-[#0f172a]">
              <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">مستخدمين</div>
              <pre className="overflow-auto text-xs text-gray-700 dark:text-gray-200">{JSON.stringify(d.usersGrowth ?? [], null, 2)}</pre>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-[#0f172a]">
              <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">عقارات</div>
              <pre className="overflow-auto text-xs text-gray-700 dark:text-gray-200">{JSON.stringify(d.propertiesGrowth ?? [], null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

