"use client";

import * as React from "react";
import {
  DollarSign,
  Receipt,
  Percent,
  Building,
  CreditCard,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";
import { formatDaysUntilAr } from "@/lib/owner-tenant-privacy";

type StatCard = {
  label: string;
  value: string;
  unit: "ر.س" | "%";
  icon: React.ElementType;
  color: string;
};

type ChartPoint = { month: string; roi: number; rent: number };

type PendingRow = {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  rentDueLabel: string;
  date: string;
  amount: number;
  overdue: string;
  status: "overdue" | "pending";
};

type DayMarker = {
  kind: "task" | "revenue" | "expense" | "payment" | "contract";
  label: string;
};

const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function fmtSar(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString("ar-SA");
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

const calendarTabs = [
  { id: "all", label: "الكل" },
  { id: "tasks", label: "المهام" },
  { id: "revenues", label: "الإيرادات" },
  { id: "expenses", label: "المصروفات" },
  { id: "fixed", label: "عقود التثبيت" },
  { id: "ending", label: "عقود تنتهي قريبا" },
];

export function OwnerHomeDashboard({
  showHeader = true,
  showStatsCards = true,
}: {
  showHeader?: boolean;
  showStatsCards?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState("all");
  const [monthCursor, setMonthCursor] = React.useState(() => new Date());
  const [chartMetric, setChartMetric] = React.useState<"roi" | "rent">("roi");
  const [loading, setLoading] = React.useState(true);
  const refreshTick = useRealtimeRefresh();

  const [netIncomeSar, setNetIncomeSar] = React.useState(0);
  const [statsData, setStatsData] = React.useState<StatCard[]>([
    { label: "إجمالي الإيجارات", value: "0", unit: "ر.س", icon: DollarSign, color: "bg-blue-100 text-blue-600" },
    { label: "إجمالي التكاليف", value: "0", unit: "ر.س", icon: Receipt, color: "bg-red-100 text-red-600" },
    { label: "نسبة صافي الدخل", value: "0", unit: "%", icon: Percent, color: "bg-purple-100 text-purple-600" },
    { label: "إجمالي الوحدات المؤجرة", value: "0", unit: "%", icon: Building, color: "bg-indigo-100 text-indigo-600" },
  ]);
  const [chartData, setChartData] = React.useState<ChartPoint[]>(() =>
    arMonths.map((m) => ({ month: m, roi: 0, rent: 0 }))
  );
  const [pendingCollections, setPendingCollections] = React.useState<PendingRow[]>([]);
  const [monthPayments, setMonthPayments] = React.useState<any[]>([]);
  const [monthCollectionsRate, setMonthCollectionsRate] = React.useState(0);
  const [monthCollectedSar, setMonthCollectedSar] = React.useState(0);
  const [calendarMarks, setCalendarMarks] = React.useState<Record<string, DayMarker[]>>({});

  const metricLabel = chartMetric === "roi" ? "العائد على الاستثمار" : "الإيجار السنوي";
  const monthLabel = React.useMemo(() => {
    return `${arMonths[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
  }, [monthCursor]);

  const monthYmd = React.useMemo(() => {
    const y = monthCursor.getFullYear();
    const m = String(monthCursor.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [monthCursor]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const y = new Date().getFullYear();
        const res = await authFetch(`/api/dashboard/stats?year=${y}&month=${monthYmd}`);
        if (!res.ok) { if (!cancelled) setLoading(false); return; }
        const stats = await res.json();

        if (cancelled) return;

        const monthToIndex = (ymd: string) => {
          const m = Number(String(ymd).slice(5, 7));
          return Number.isFinite(m) ? Math.max(1, Math.min(12, m)) - 1 : 0;
        };

        const monthPoints = arMonths.map((m) => ({ month: m, roi: 0, rent: 0 }));
        for (const row of stats.monthly ?? []) {
          const idx = monthToIndex(String(row.month));
          monthPoints[idx].rent = Number(row.income_sar) || 0;
          monthPoints[idx].roi = Number(row.net_sar) || 0;
        }
        setChartData(monthPoints);

        const totalIncome = (stats.monthly ?? []).reduce((a: number, r: any) => a + (Number(r.income_sar) || 0), 0);
        const totalExpenses = (stats.monthly ?? []).reduce((a: number, r: any) => a + (Number(r.expenses_sar) || 0), 0);
        const netAmount = totalIncome - totalExpenses;
        const netRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0;
        setNetIncomeSar(netAmount);
        const totUnits = Number(stats.totalUnits) || 0;
        const occUnits = Number(stats.occupiedUnits) || 0;
        const occRate = totUnits > 0 ? (occUnits / totUnits) * 100 : 0;

        setStatsData([
          { label: "إجمالي الإيجارات", value: fmtSar(totalIncome), unit: "ر.س", icon: DollarSign, color: "bg-blue-100 text-blue-600" },
          { label: "إجمالي التكاليف", value: fmtSar(totalExpenses), unit: "ر.س", icon: Receipt, color: "bg-red-100 text-red-600" },
          { label: "نسبة صافي الدخل", value: netRate.toFixed(2), unit: "%", icon: Percent, color: "bg-purple-100 text-purple-600" },
          { label: "إجمالي الوحدات المؤجرة", value: occRate.toFixed(0), unit: "%", icon: Building, color: "bg-indigo-100 text-indigo-600" },
        ]);

        const monthPaymentsArr: any[] = stats.monthPayments ?? [];
        const monthTotalDue = monthPaymentsArr.reduce((a: number, r: any) => a + (Number(r.amount_sar) || 0), 0);
        const monthTotalPaid = monthPaymentsArr.reduce((a: number, r: any) => a + (r.status === "paid" ? Number(r.amount_sar) || 0 : 0), 0);
        setMonthCollectedSar(monthTotalPaid);
        setMonthCollectionsRate(monthTotalDue > 0 ? (monthTotalPaid / monthTotalDue) * 100 : 0);
        setMonthPayments(monthPaymentsArr);

        const now = new Date();
        setPendingCollections(
          (stats.pendingPayments ?? []).map((r: any) => {
            const due = r.due_date ? new Date(String(r.due_date)) : null;
            const days = due ? daysBetween(due, now) : 0;
            const summary = r.owner_contract_summary;
            return {
              id: String(r.id),
              property: String(r.property_name ?? "—"),
              unit: String(r.unit_label ?? "—"),
              tenant: String(r.tenantName ?? "—"),
              rentDueLabel: summary
                ? formatDaysUntilAr(summary.days_until_next_rent_due)
                : "—",
              date: r.due_date ? String(r.due_date) : "—",
              amount: Number(r.amount_sar) || 0,
              overdue: summary
                ? formatDaysUntilAr(summary.days_until_next_rent_due)
                : `${days} يوم`,
              status: days > 0 ? "overdue" : "pending",
            } satisfies PendingRow;
          })
        );

        const cal = stats.calendarData ?? {};
        const nextMarks: Record<string, DayMarker[]> = {};
        const push = (ymd: string, mark: DayMarker) => { if (!ymd) return; (nextMarks[ymd] ||= []).push(mark); };

        for (const t of cal.tasks ?? []) push(t.due_date ? String(t.due_date) : "", { kind: "task", label: "مهمة" });
        for (const r of cal.revenues ?? []) push(r.received_at ? String(r.received_at).slice(0, 10) : "", { kind: "revenue", label: "إيراد" });
        for (const e of cal.expenses ?? []) push(e.paid_at ? String(e.paid_at).slice(0, 10) : "", { kind: "expense", label: "مصروف" });
        for (const p of cal.monthPayments ?? []) push(p.due_date ? String(p.due_date) : "", { kind: "payment", label: "دفعة" });
        for (const c of cal.contracts ?? []) {
          if (c.start_date) push(String(c.start_date), { kind: "contract", label: "بداية عقد" });
          if (c.end_date) push(String(c.end_date), { kind: "contract", label: "نهاية عقد" });
        }
        setCalendarMarks(nextMarks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [monthYmd, refreshTick]);

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الرئيسية</h1>
        </div>
      ) : null}

      {showStatsCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.unit === "ر.س" && <span className="text-sm font-normal">ر.س </span>}
                        {stat.value}
                        {stat.unit === "%" && <span className="text-sm font-normal">%</span>}
                      </span>
                    </div>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-current opacity-5" />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Charts and Side Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChartMetric("roi")}
                className={["inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition", chartMetric === "roi" ? "bg-indigo-600 text-white" : "border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"].join(" ")}
              >
                العائد على الاستثمار
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("rent")}
                className={["inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition", chartMetric === "rent" ? "bg-yellow-500 text-white" : "border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"].join(" ")}
              >
                الإيجار السنوي
              </button>
            </div>
          </div>
          <div className="relative h-64">
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {chartData.map((data, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full">
                    {(chartMetric === "roi" ? data.roi : data.rent) > 0 && (
                      <div
                        className={["w-full rounded-t", chartMetric === "roi" ? "bg-indigo-500" : "bg-yellow-500"].join(" ")}
                        style={{ height: `${Math.min(200, ((chartMetric === "roi" ? data.roi : data.rent) / 80000) * 200)}px` }}
                      >
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 dark:text-gray-400">
                          {(chartMetric === "roi" ? data.roi : data.rent).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{data.month}</span>
                </div>
              ))}
            </div>
            <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-[10px] text-gray-400">
              <span>80,000</span><span>60,000</span><span>40,000</span><span>20,000</span><span>0</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">صافي الدخل السنوي</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-gray-400">ر.س</span>
                <span className={["text-2xl font-bold", netIncomeSar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"].join(" ")}>
                  {fmtSar(Math.abs(netIncomeSar))}
                </span>
              </div>
              <div className={["flex h-12 w-12 items-center justify-center rounded-full", netIncomeSar >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"].join(" ")}>
                <CreditCard className={["h-6 w-6", netIncomeSar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"].join(" ")} />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">{netIncomeSar < 0 ? "▼ خسارة" : "▲ ربح"} للسنة الحالية</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">تحصيلات الشهر الحالي</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-gray-400">%</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{monthCollectionsRate.toFixed(0)}</span>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#1a3528]">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.max(0, Math.min(100, monthCollectionsRate))}%` }} />
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي المبالغ المتحصلة</p>
            <p className="text-xs text-gray-400">({fmtSar(monthCollectedSar)})</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#1a3528]">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, monthCollectionsRate))}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pending Collections Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex items-center gap-2 border-b border-gray-100 p-4 dark:border-emerald-800/30">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Receipt className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">التحصيلات المعلقة السابقة</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">العقار</th>
                  <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                  <th className="px-4 py-3 text-right font-medium">العقار / الوحدة</th>
                  <th className="px-4 py-3 text-right font-medium">تحصيل الإيجار</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium">الموعد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {pendingCollections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-500">
                      <Search className="mx-auto h-8 w-8 mb-2" />
                      لا توجد تحصيلات معلقة
                    </td>
                  </tr>
                ) : (
                  pendingCollections.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {item.property}
                        <span className="block text-xs text-gray-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.rentDueLabel}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="text-red-500">{item.overdue}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Receipt className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">دفعات الشهر الحالي</h3>
            </div>
            <span className="text-xs text-gray-400">{monthLabel}</span>
          </div>
          <div className="overflow-x-auto">
            {monthPayments.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center">
                <Search className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">لا توجد دفعات هذا الشهر</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">العقار / الوحدة</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {monthPayments.slice(0, 8).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {p.property_name ?? "—"}
                        {p.unit_label ? (
                          <span className="block text-xs text-gray-500">{p.unit_label}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{(Number(p.amount_sar) || 0).toLocaleString("ar-SA")} ر.س</td>
                      <td className="px-4 py-3">
                        <span className={["rounded-full px-2 py-0.5 text-xs font-medium", p.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : p.status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"].join(" ")}>
                          {p.status === "paid" ? "مدفوعة" : p.status === "overdue" ? "متأخرة" : "معلقة"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {calendarTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={["rounded-lg px-4 py-2 text-sm font-medium transition", activeTab === tab.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1a3528] dark:text-gray-300 dark:hover:bg-[#244033]"].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 dark:border-emerald-800/50 dark:hover:bg-[#1a3528]"
            >
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 dark:border-emerald-800/50 dark:hover:bg-[#1a3528]"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date())}
              className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
            >
              اليوم
            </button>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{monthLabel}</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {calendarTabs.find((t) => t.id === activeTab)?.label ?? "الكل"}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">{day}</div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const firstOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
            const jsDay = firstOfMonth.getDay();
            const startOffset = (jsDay + 1) % 7;
            const day = i - startOffset + 1;
            const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
            const isCurrentMonth = day >= 1 && day <= daysInMonth;
            const today = new Date();
            const isToday = isCurrentMonth && day === today.getDate() && monthCursor.getMonth() === today.getMonth() && monthCursor.getFullYear() === today.getFullYear();
            const ymd = isCurrentMonth ? new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day).toISOString().split("T")[0] : "";
            const marks = ymd ? calendarMarks[ymd] ?? [] : [];

            return (
              <div
                key={i}
                className={[
                  "min-h-[80px] rounded-lg border p-2 transition",
                  isCurrentMonth ? "border-gray-100 bg-white dark:border-emerald-800/30 dark:bg-[#1a3528]" : "border-transparent bg-gray-50/50 dark:bg-[#0f291e]/50",
                  isToday && "border-indigo-500 ring-1 ring-indigo-500",
                  marks.length > 0 && "bg-indigo-50 dark:bg-indigo-900/20",
                ].join(" ")}
              >
                {isCurrentMonth && (
                  <>
                    <span className={["text-sm", isToday ? "font-bold text-indigo-600" : "text-gray-700 dark:text-gray-300"].join(" ")}>{day}</span>
                    {marks.slice(0, 2).map((m, idx) => (
                      <div
                        key={`${m.kind}-${idx}`}
                        className={["mt-1 rounded px-2 py-0.5 text-[10px] text-white", m.kind === "task" ? "bg-amber-500" : m.kind === "revenue" ? "bg-emerald-600" : m.kind === "expense" ? "bg-red-600" : m.kind === "payment" ? "bg-indigo-600" : "bg-slate-600"].join(" ")}
                      >
                        {m.label}
                      </div>
                    ))}
                    {marks.length > 2 && <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">+{marks.length - 2}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
