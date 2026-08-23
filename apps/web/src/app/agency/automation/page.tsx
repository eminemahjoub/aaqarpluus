"use client";

import * as React from "react";
import { Zap, AlertTriangle, CheckCircle2, Calendar, Clock, Users, Building2, FileText } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useMutation, useQuery } from "@tanstack/react-query";

type AutomationResult = {
  success: boolean;
  today: string;
  results: {
    expiredContracts: number;
    freedUnits: number;
    tasksCreated: number;
  };
  message: string;
};

export default function AgencyAutomationPage() {
  const [lastRun, setLastRun] = React.useState<AutomationResult | null>(null);

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/automation/run", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "فشل تشغيل الأتمتة");
      }
      return res.json() as Promise<AutomationResult>;
    },
    onSuccess: (data) => setLastRun(data),
  });

  const summaryQuery = useQuery({
    queryKey: ["agency", "automation", "summary"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [expiringRes, overdueRes, activeContractsRes] = await Promise.all([
        authFetch(`/api/contracts?status=active&date_to=${today}`),
        authFetch(`/api/contract-payments?status=pending&date_to=${today}`),
        authFetch("/api/contracts?status=active"),
      ]);
      const expiring = expiringRes.ok ? await expiringRes.json() : [];
      const overduePayments = overdueRes.ok ? await overdueRes.json() : [];
      const activeContracts = activeContractsRes.ok ? await activeContractsRes.json() : [];
      return {
        expiringContracts: (expiring ?? []).length,
        overduePayments: (overduePayments ?? []).length,
        activeContracts: (activeContracts ?? []).length,
      };
    },
    refetchInterval: 60000,
  });

  const summary = summaryQuery.data ?? { expiringContracts: 0, overduePayments: 0, activeContracts: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الأتمتة الذكية</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          تشغيل قواعد الأتمتة لتحديث الحالات وإنشاء التنبيهات تلقائياً
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">عقود فعالة</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.activeContracts}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">عقود تنتهي قريباً</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.expiringContracts}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">مدفوعات متأخرة</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.overduePayments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">تشغيل الأتمتة الآن</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              سيتم: تحديث العقود المنتهية + إخلاء الوحدات + إنشاء مهام التجديد
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Zap className="h-4 w-4" />
            {runMutation.isPending ? "جاري التشغيل..." : "تشغيل الأتمتة"}
          </button>
        </div>

        {runMutation.isError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {(runMutation.error as Error)?.message ?? "خطأ"}
          </div>
        ) : null}

        {lastRun ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>تم التشغيل بنجاح — {lastRun.today}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md bg-white p-2 dark:bg-[#132a1f]">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{lastRun.results.expiredContracts}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">عقود انتهت</p>
              </div>
              <div className="rounded-md bg-white p-2 dark:bg-[#132a1f]">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{lastRun.results.freedUnits}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">وحدات تُحررت</p>
              </div>
              <div className="rounded-md bg-white p-2 dark:bg-[#132a1f]">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{lastRun.results.tasksCreated}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">مهام جديدة</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Rules List */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="border-b border-gray-100 p-4 dark:border-emerald-800/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">قواعد الأتمتة النشطة</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-emerald-800/30">
          {[
            {
              icon: FileText,
              title: "تحديث العقود المنتهية",
              desc: "تغيير حالة العقود من 'فعال' إلى 'منتهي' تلقائياً بعد تاريخ الانتهاء",
              color: "text-blue-600 dark:text-blue-300",
              bg: "bg-blue-100 dark:bg-blue-900/30",
            },
            {
              icon: Building2,
              title: "إخلاء الوحدات تلقائياً",
              desc: "عند انتهاء العقد، يتم تغيير حالة الوحدة من 'مؤجرة' إلى 'متاحة'",
              color: "text-emerald-600 dark:text-emerald-300",
              bg: "bg-emerald-100 dark:bg-emerald-900/30",
            },
            {
              icon: Users,
              title: "تنبيه تجديد العقود",
              desc: "إنشاء مهام تذكير قبل 30 يوم من انتهاء العقد",
              color: "text-amber-600 dark:text-amber-300",
              bg: "bg-amber-100 dark:bg-amber-900/30",
            },
            {
              icon: Calendar,
              title: "جدولة المدفوعات",
              desc: "إنشاء جدول مدفوعات تلقائي عند إضافة عقد جديد",
              color: "text-purple-600 dark:text-purple-300",
              bg: "bg-purple-100 dark:bg-purple-900/30",
            },
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${rule.bg}`}>
                <rule.icon className={`h-5 w-5 ${rule.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{rule.title}</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rule.desc}</p>
              </div>
              <div className="mr-auto">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  نشط
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
