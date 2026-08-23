"use client";

import * as React from "react";
import { RefreshCw, ShieldAlert, TrendingUp, AlertTriangle, CheckCircle2, Brain } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { RiskScoreBadge } from "./RiskScoreBadge";
import { MaintenancePredictionCard, type PredictionObject } from "./MaintenancePredictionCard";

const SUMMARY_ITEMS = [
  { level: "low", label: "وحدات بخطر منخفض", icon: CheckCircle2, card: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { level: "medium", label: "وحدات بخطر متوسط", icon: AlertTriangle, card: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { level: "high", label: "وحدات بخطر مرتفع", icon: ShieldAlert, card: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400", chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { level: "critical", label: "وحدات بخطر حرج", icon: TrendingUp, card: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400", chip: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

function failureTypeLabel(t: string): string {
  const map: Record<string, string> = { ac: "مكيف", plumbing: "سباكة", electrical: "كهرباء", general: "عام" };
  return map[t] ?? t;
}

export function PredictiveMaintenanceDashboard() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: PredictionObject[]; pagination: { total: number } }>({
    queryKey: ["maintenance", "predictions", "all"],
    queryFn: async () => {
      const res = await authFetch("/api/maintenance/predictions?limit=200");
      if (!res.ok) throw new Error("فشل تحميل التنبؤات");
      return res.json();
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/maintenance/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("فشل تشغيل التحليل");
      return res.json();
    },
    onSuccess: (result) => {
      setNotice(`تم تحليل ${result.processed ?? 0} وحدة بنجاح`);
      void queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] });
    },
    onError: () => setNotice("حدث خطأ أثناء التحليل"),
  });

  const [trainResult, setTrainResult] = React.useState<string | null>(null);
  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/maintenance/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("فشل تدريب النموذج");
      return res.json();
    },
    onSuccess: (result) => {
      if (!result.trained) {
        setTrainResult(result.reason ?? "بيانات غير كافية للتدريب");
        return;
      }
      setTrainResult(
        `تم تدريب النموذج: دقة ${(result.metrics.accuracy * 100).toFixed(1)}% على ${result.samples.total} عينة (${result.samples.positive} أعطال / ${result.samples.negative} سليمة)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] });
    },
    onError: () => setTrainResult("حدث خطأ أثناء تدريب النموذج"),
  });

  const items = (data?.data ?? []).filter((p) => !p.isResolved);
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const p of items) {
    if (counts[p.riskLevel as keyof typeof counts] !== undefined) counts[p.riskLevel as keyof typeof counts]++;
  }
  const top5 = [...items].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">التنبؤات الوقائية</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">تحليل ذكي يكتشف أعطال المكيفات والسباكة والكهرباء قبل حدوثها</p>
        </div>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${runMutation.isPending ? "animate-spin" : ""}`} aria-hidden />
          {runMutation.isPending ? "جاري التحليل..." : "تشغيل التحليل"}
        </button>
        <button
          type="button"
          onClick={() => trainMutation.mutate()}
          disabled={trainMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
        >
          <Brain className={`h-4 w-4 ${trainMutation.isPending ? "animate-pulse" : ""}`} aria-hidden />
          {trainMutation.isPending ? "جاري التدريب..." : "تدريب نموذج الذكاء الاصطناعي"}
        </button>
      </div>

      {trainResult ? (
        <p className="rounded-xl border border-indigo-600/30 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" role="status">
          {trainResult}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.level} className={`flex items-center justify-between rounded-2xl border border-gray-200 p-5 shadow-sm dark:border-emerald-800/30 ${item.card}`}>
              <div>
                <p className="text-3xl font-bold tabular-nums">{counts[item.level as keyof typeof counts]}</p>
                <p className="mt-1 text-sm font-medium">{item.label}</p>
              </div>
              <Icon className="h-8 w-8 opacity-70" aria-hidden />
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500 dark:border-emerald-800/40 dark:text-gray-400">
          لا توجد تنبؤات بعد — اضغط "تشغيل التحليل" لتحليل وحداتك
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="border-b border-gray-200 px-5 py-3.5 dark:border-emerald-800/30">
              <h3 className="font-bold text-gray-900 dark:text-white">أهم 5 وحدات تحتاج انتباهك</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3 text-right font-medium">الوحدة</th>
                    <th className="px-5 py-3 text-right font-medium">العقار</th>
                    <th className="px-5 py-3 text-right font-medium">الخطورة</th>
                    <th className="px-5 py-3 text-right font-medium">العطل المتوقع</th>
                    <th className="px-5 py-3 text-right font-medium">الأيام المتبقية</th>
                    <th className="px-5 py-3 text-right font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {top5.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{p.unit.name}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{p.unit.property.name}</td>
                      <td className="px-5 py-3">
                        <RiskScoreBadge score={p.riskScore} level={p.riskLevel} />
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{failureTypeLabel(p.predictedFailureType)}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        {p.predictedFailureDate ? (
                          (() => {
                            const days = Math.round((new Date(p.predictedFailureDate).getTime() - Date.now()) / 86400000);
                            return days >= 0 ? `${days} يوم` : "—";
                          })()
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] })}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:text-gray-300"
                        >
                          تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {top5.map((p) => (
              <MaintenancePredictionCard
                key={p.id}
                prediction={p}
                onResolve={() => queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
