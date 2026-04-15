"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { PageLoading, ErrorState } from "@/components/ui/states";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Stats = {
  users: { total: number; owners: number; agencies: number; superadmins: number };
  properties: { total: number };
  units: { total: number };
  contracts: { active: number };
  recentUsers: Array<{ id: string; full_name: string | null; email: string; phone: string | null; user_type: string; created_at: string | null }>;
  recentAudit: Array<{ id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string | null; user_email: string | null }>;
  charts: {
    userGrowth12m: Array<{ month: string; count: number }>;
    propertiesByCity: Array<{ city: string; count: number }>;
    userDistribution: Array<{ role: string; count: number }>;
  };
};

function StatCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70">
      <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[#C5A021]/15 blur-2xl" />
      <div className="text-xs font-bold text-gray-600 dark:text-gray-300">{title}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70">
      <div className="mb-3 text-sm font-extrabold text-gray-900 dark:text-white">{title}</div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/40 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/90 dark:text-white">
      <div className="font-bold">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="mt-1 flex items-center justify-between gap-3">
          <span className="opacity-80">{p.name ?? p.dataKey}</span>
          <span className="font-extrabold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminHomePage() {
  const q = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/stats");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذر تحميل الإحصائيات");
      }
      return (await res.json()) as Stats;
    },
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const s = q.data!;
  const lineData = s.charts.userGrowth12m.map((r) => ({ month: r.month, users: r.count }));
  const barData = s.charts.propertiesByCity.map((r) => ({ city: r.city || "—", properties: r.count }));
  const pieData = s.charts.userDistribution.map((r) => ({ role: r.role, value: r.count }));
  const pieColors = ["#10b981", "#C5A021", "#34d399", "#f59e0b"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">ملخص سريع عن المنصة</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="إجمالي المستخدمين" value={s.users.total} />
        <StatCard title="إجمالي العقارات" value={s.properties.total} />
        <StatCard title="إجمالي الوحدات" value={s.units.total} />
        <StatCard title="العقود النشطة" value={s.contracts.active} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="نمو المستخدمين الجدد (آخر 12 شهر)">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(16,185,129,0.18)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="users" name="مستخدمين" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="العقارات حسب المدينة (Top 10)">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(197,160,33,0.16)" />
                <XAxis dataKey="city" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="properties" name="عقارات" fill="#C5A021" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="توزيع المستخدمين">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie data={pieData} dataKey="value" nameKey="role" innerRadius={55} outerRadius={90} paddingAngle={4}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {pieData.map((r, i) => (
                <div key={r.role} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                  <span className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                    {r.role === "owner" ? "ملاك" : r.role === "agency" ? "مكاتب" : r.role === "superadmin" ? "سوبر أدمن" : r.role}
                  </span>
                  <span className="font-extrabold text-gray-900 dark:text-white">{r.value}</span>
                </div>
              ))}
              <div className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                ملاك: {s.users.owners} • مكاتب: {s.users.agencies} • سوبر أدمن: {s.users.superadmins}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70">
          <div className="mb-3 text-sm font-extrabold text-gray-900 dark:text-white">آخر المستخدمين المسجلين</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الإيميل</th>
                  <th className="px-3 py-2 text-right">الدور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
                {s.recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{u.email}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{u.user_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70">
          <div className="mb-3 text-sm font-extrabold text-gray-900 dark:text-white">آخر العمليات</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-right">العملية</th>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">المستخدم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
                {s.recentAudit.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                    <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{a.action}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{a.entity_type ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{a.user_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

