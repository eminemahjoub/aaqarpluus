"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Wrench, PiggyBank } from "lucide-react";
import { PredictiveMaintenanceDashboard } from "@/components/maintenance/PredictiveMaintenanceDashboard";
import { RiskScoreBadge } from "@/components/maintenance/RiskScoreBadge";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

type PredictionRow = {
  id: string;
  unit: { id: string; name: string; property: { id: string; name: string } };
  riskScore: number;
  riskLevel: string;
  predictedFailureType: string;
  predictedFailureTypeLabel?: string;
  predictedFailureDate: string | null;
  suggestedAction: string;
  estimatedCostSar: number | null;
  createdAt: string;
  isResolved?: boolean;
};

export default function MaintenanceManagementPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"current" | "predictive">("current");
  const [riskFilter, setRiskFilter] = useState("");
  const [resolvedOnly, setResolvedOnly] = useState(false);

  async function loadRequests() {
    try {
      const res = await fetch("/api/tasks?type=maintenance", { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل طلبات الصيانة");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("فشل تحديث الحالة");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function updatePriority(id: string, priority: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("فشل تحديث الأولوية");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      pending: "معلّق",
      in_progress: "قيد التنفيذ",
      done: "مكتمل",
      cancelled: "ملغى",
    };
    return map[status] ?? status;
  }

  // Predictive insights data
  const { data: predictionsData } = useQuery<{ data: PredictionRow[]; pagination: { total: number } }>({
    queryKey: ["maintenance", "predictions", "page", riskFilter, resolvedOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (riskFilter) params.set("risk_level", riskFilter);
      if (resolvedOnly) params.set("resolved", "true");
      const res = await authFetch(`/api/maintenance/predictions?${params.toString()}`);
      if (!res.ok) throw new Error("فشل تحميل التنبؤات");
      return res.json();
    },
    enabled: tab === "predictive",
  });

  const predictions = (predictionsData?.data ?? []).filter((p) => (resolvedOnly ? true : !p.isResolved));
  const savings = predictionsData?.data
    ? predictionsData.data
        .filter((p) => (p.riskLevel === "high" || p.riskLevel === "critical") && p.isResolved)
        .reduce((acc, p) => acc + (p.estimatedCostSar ?? 0), 0) * 0.3
    : 0;

  async function resolvePrediction(id: string) {
    try {
      const res = await authFetch(`/api/maintenance/predictions/${id}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error("فشل الحل");
      void loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  const failureLabel: Record<string, string> = {
    ac: "مكيف",
    plumbing: "سباكة",
    electrical: "كهرباء",
    general: "عام",
  };

  if (loading && tab === "current") {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-[#0f1e14]">
        <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-[#0f1e14]" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة طلبات الصيانة</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            لوحة التحكم
          </Link>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {/* Tabs */}
        <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <button
            type="button"
            onClick={() => setTab("current")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === "current"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#1a3528]"
            }`}
          >
            <Wrench className="h-4 w-4" aria-hidden />
            الصيانة الحالية
          </button>
          <button
            type="button"
            onClick={() => setTab("predictive")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === "predictive"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#1a3528]"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            التنبؤات الوقائية
          </button>
        </div>

        {tab === "current" ? (
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الطلب</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                    <th className="px-4 py-3 text-right font-medium">المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        لا توجد طلبات صيانة
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{req.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{req.description}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{req.property?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{req.unit?.label ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{req.tenant?.name ?? req.contact?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <select
                            value={req.priority}
                            onChange={(e) => updatePriority(req.id, e.target.value)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                          >
                            <option value="low">منخفضة</option>
                            <option value="medium">متوسطة</option>
                            <option value="high">عالية</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={req.status}
                            onChange={(e) => updateStatus(req.id, e.target.value)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                          >
                            <option value="pending">معلّق</option>
                            <option value="in_progress">قيد التنفيذ</option>
                            <option value="done">مكتمل</option>
                            <option value="cancelled">ملغى</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {req.created_at ? String(req.created_at).split("T")[0] : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <PredictiveMaintenanceDashboard />

            {/* Estimated savings */}
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-600/30 bg-emerald-50 p-5 dark:border-emerald-800/40 dark:bg-emerald-900/10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10">
                <PiggyBank className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
              </span>
              <div>
                <p className="font-bold text-emerald-800 dark:text-emerald-300">التوفير التقديري</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  لقد وفرت على مكتبك ما يقارب {Math.round(savings).toLocaleString("ar-SA")} ريال هذا الشهر بفضل الصيانة الوقائية
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              >
                <option value="">كل مستويات الخطورة</option>
                <option value="critical">حرج</option>
                <option value="high">مرتفع</option>
                <option value="medium">متوسط</option>
                <option value="low">منخفض</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={resolvedOnly}
                  onChange={(e) => setResolvedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
                />
                عرض المحلولة فقط
              </label>
            </div>

            {/* Full predictions table */}
            <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <div className="border-b border-gray-200 px-5 py-3.5 dark:border-emerald-800/30">
                <h3 className="font-bold text-gray-900 dark:text-white">جميع التنبؤات ({predictions.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                      <th className="px-4 py-3 text-right font-medium">العقار</th>
                      <th className="px-4 py-3 text-right font-medium">الخطورة</th>
                      <th className="px-4 py-3 text-right font-medium">العطل المتوقع</th>
                      <th className="px-4 py-3 text-right font-medium">التاريخ المتوقع</th>
                      <th className="px-4 py-3 text-right font-medium">التكلفة التقديرية</th>
                      <th className="px-4 py-3 text-right font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                    {predictions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          لا توجد تنبؤات
                        </td>
                      </tr>
                    ) : (
                      predictions.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{p.unit.name}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.unit.property.name}</td>
                          <td className="px-4 py-3">
                            <RiskScoreBadge score={p.riskScore} level={p.riskLevel} />
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {p.predictedFailureTypeLabel ?? failureLabel[p.predictedFailureType] ?? p.predictedFailureType}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {p.predictedFailureDate ? new Date(p.predictedFailureDate).toLocaleDateString("ar-SA") : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {p.estimatedCostSar != null ? `${p.estimatedCostSar.toLocaleString("ar-SA")} ر.س` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {!p.isResolved ? (
                              <button
                                type="button"
                                onClick={() => resolvePrediction(p.id)}
                                className="rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                              >
                                تم الحل
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">محلولة</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
