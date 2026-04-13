"use client";

import * as React from "react";
import { Building, Users, FileText, TrendingUp, DollarSign, Clock } from "lucide-react";

function fmtSar(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString("ar-SA");
}

export function AgencyDashboard({ showHeader = true }: { showHeader?: boolean }) {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({
    totalProperties: 0,
    totalContacts: 0,
    totalContracts: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    activeContracts: 0,
  });

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [propsRes, contactsRes, dashRes] = await Promise.all([
          fetch("/api/properties"),
          fetch("/api/contacts"),
          fetch(`/api/dashboard/stats?year=${new Date().getFullYear()}`),
        ]);
        const props = propsRes.ok ? await propsRes.json() : [];
        const contacts = contactsRes.ok ? await contactsRes.json() : [];
        const dash = dashRes.ok ? await dashRes.json() : {};

        const totalRevenue = (dash.monthly ?? []).reduce((a: number, r: any) => a + (Number(r.income_sar) || 0), 0);
        const pending = (dash.pendingPayments ?? []).reduce((a: number, r: any) => a + (Number(r.amount_sar) || 0), 0);

        setStats({
          totalProperties: (props ?? []).length,
          totalContacts: (contacts ?? []).length,
          totalContracts: dash.totalContracts ?? 0,
          totalRevenue,
          pendingPayments: pending,
          activeContracts: dash.activeContracts ?? 0,
        });
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const cards = [
    { label: "إجمالي العقارات", value: String(stats.totalProperties), icon: Building, color: "bg-blue-100 text-blue-600" },
    { label: "جهات الاتصال", value: String(stats.totalContacts), icon: Users, color: "bg-purple-100 text-purple-600" },
    { label: "العقود الفعالة", value: String(stats.activeContracts), icon: FileText, color: "bg-emerald-100 text-emerald-600" },
    { label: "إجمالي الإيرادات", value: `${fmtSar(stats.totalRevenue)} ر.س`, icon: TrendingUp, color: "bg-indigo-100 text-indigo-600" },
    { label: "المدفوعات المعلقة", value: `${fmtSar(stats.pendingPayments)} ر.س`, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
    { label: "إجمالي العقود", value: String(stats.totalContracts), icon: DollarSign, color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة تحكم المكتب</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">إحصائيات عامة لجميع العقارات والعقود</p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-[#132a1f]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}
