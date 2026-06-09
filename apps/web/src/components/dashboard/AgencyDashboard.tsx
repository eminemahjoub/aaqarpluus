"use client";

import * as React from "react";
import { Building, Users, FileText, TrendingUp, DollarSign, Clock, Percent } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery } from "@tanstack/react-query";
import { onSyncEvent } from "@/lib/sync-engine";

function fmtSar(n: number) {
  return (Number.isFinite(n) ? n : 0).toLocaleString("ar-SA");
}

export function AgencyDashboard({ showHeader = true }: { showHeader?: boolean }) {
  const [forceTick, setForceTick] = React.useState(0);

  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ["dashboard", "stats", "agency", forceTick],
    queryFn: async () => {
      const y = new Date().getFullYear();
      const m = String(new Date().getMonth() + 1).padStart(2, "0");
      const ym = `${y}-${m}`;

      const [propsRes, contactsRes, dashRes, commRes] = await Promise.all([
        authFetch("/api/properties"),
        authFetch("/api/contacts"),
        authFetch(`/api/dashboard/stats?year=${y}`),
        authFetch(`/api/agency/commissions?year=${y}&month=${ym}`),
      ]);
      const props = propsRes.ok ? await propsRes.json() : [];
      const contacts = contactsRes.ok ? await contactsRes.json() : [];
      const dash = dashRes.ok ? await dashRes.json() : {};
      const comm = commRes.ok ? await commRes.json() : {};

      const totalRevenue = (dash.monthly ?? []).reduce((a: number, r: any) => a + (Number(r.income_sar) || 0), 0);
      const pending = (dash.pendingPayments ?? []).reduce((a: number, r: any) => a + (Number(r.amount_sar) || 0), 0);

      return {
        totalProperties: (props ?? []).length,
        totalContacts: (contacts ?? []).length,
        totalContracts: dash.totalContracts ?? 0,
        totalRevenue,
        pendingPayments: pending,
        activeContracts: dash.activeContracts ?? 0,
        monthCommission: Number(comm?.monthCommissionSar) || 0,
        yearCommission: Number(comm?.yearCommissionSar) || 0,
      };
    },
    refetchInterval: 30000, // auto-refresh every 30 seconds
    refetchIntervalInBackground: true,
    staleTime: 15000,
  });

  // Listen to cross-tab sync events
  React.useEffect(() => {
    const unsub = onSyncEvent(() => {
      setForceTick((t) => t + 1);
    });
    return () => { unsub(); };
  }, []);

  const s = stats ?? {
    totalProperties: 0,
    totalContacts: 0,
    totalContracts: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    activeContracts: 0,
    monthCommission: 0,
    yearCommission: 0,
  };

  const cards = [
    { label: "إجمالي العقارات", value: String(s.totalProperties), icon: Building, color: "bg-blue-100 text-blue-600" },
    { label: "جهات الاتصال", value: String(s.totalContacts), icon: Users, color: "bg-purple-100 text-purple-600" },
    { label: "العقود الفعالة", value: String(s.activeContracts), icon: FileText, color: "bg-emerald-100 text-emerald-600" },
    { label: "إجمالي الإيرادات", value: `${fmtSar(s.totalRevenue)} ر.س`, icon: TrendingUp, color: "bg-indigo-100 text-indigo-600" },
    { label: "المدفوعات المعلقة", value: `${fmtSar(s.pendingPayments)} ر.س`, icon: Clock, color: "bg-yellow-100 text-yellow-600" },
    { label: "عمولة هذا الشهر", value: `${fmtSar(s.monthCommission)} ر.س`, icon: Percent, color: "bg-amber-100 text-amber-700" },
    { label: "عمولة هذا العام", value: `${fmtSar(s.yearCommission)} ر.س`, icon: DollarSign, color: "bg-red-100 text-red-600" },
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
