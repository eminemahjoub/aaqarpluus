"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OwnerFinanceDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/dashboard/stats?year=${year}`, { credentials: "include" });
        if (!res.ok) throw new Error("فشل تحميل البيانات المالية");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  const totalIncome = stats?.monthly?.reduce((s: number, m: any) => s + (Number(m.income_sar) || 0), 0) || 0;
  const totalExpenses = stats?.monthly?.reduce((s: number, m: any) => s + (Number(m.expenses_sar) || 0), 0) || 0;
  const totalCommission = stats?.totalCommissionSar || 0;
  const netProfit = totalIncome - totalExpenses;
  const occupancyRate =
    stats?.totalUnits && Number(stats.totalUnits) > 0
      ? Math.round((Number(stats.occupiedUnits) / Number(stats.totalUnits)) * 100)
      : 0;

  const pendingAmount =
    stats?.pendingPayments?.reduce((s: number, p: any) => s + (Number(p.amount_sar) || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-[#0f1e14]">
        <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f1e14]">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-[#0f1e14]" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">اللوحة المالية</h1>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
            <Link
              href="/dashboard/reports"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
            >
              التقارير
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي الإيرادات</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalIncome.toLocaleString()} ر.س</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي المصروفات</p>
            <p className="mt-2 text-2xl font-bold text-red-600">{totalExpenses.toLocaleString()} ر.س</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">صافي الربح</p>
            <p className={`mt-2 text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {netProfit.toLocaleString()} ر.س
            </p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">العمولة</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{totalCommission.toLocaleString()} ر.س</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">نسبة الإشغال</p>
            <p className="mt-2 text-2xl font-bold text-indigo-600">{occupancyRate}%</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">مدفوعات معلقة</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{pendingAmount.toLocaleString()} ر.س</p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">الملخص الشهري</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">الشهر</th>
                  <th className="px-4 py-3 text-right font-medium">الإيرادات</th>
                  <th className="px-4 py-3 text-right font-medium">المصروفات</th>
                  <th className="px-4 py-3 text-right font-medium">صافي الربح</th>
                  <th className="px-4 py-3 text-right font-medium">العمولة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {stats?.monthly?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      لا توجد بيانات مالية للعام المحدد
                    </td>
                  </tr>
                ) : (
                  stats?.monthly?.map((m: any) => (
                    <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{m.month}</td>
                      <td className="px-4 py-3 text-green-600">{Number(m.income_sar).toLocaleString()} ر.س</td>
                      <td className="px-4 py-3 text-red-600">{Number(m.expenses_sar).toLocaleString()} ر.س</td>
                      <td className={`px-4 py-3 ${Number(m.net_sar) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(m.net_sar).toLocaleString()} ر.س
                      </td>
                      <td className="px-4 py-3 text-amber-600">{Number(m.commission_sar).toLocaleString()} ر.س</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
