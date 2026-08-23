"use client";

import * as React from "react";
import Link from "next/link";
import { Wrench, Wind, Droplets, Zap, Calendar, Banknote, CheckCircle, XCircle, ClipboardList, Sparkles, Clock, Wallet } from "lucide-react";
import { RiskScoreBadge } from "./RiskScoreBadge";
import { authFetch } from "@/lib/auth-fetch";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type PredictionObject = {
  id: string;
  unit: { id: string; name: string; property: { id: string; name: string } };
  riskScore: number;
  riskLevel: string;
  predictedFailureType: string;
  predictedFailureTypeLabel?: string;
  predictedFailureDate: string | null;
  suggestedAction: string;
  estimatedCostSar: number | null;
  isResolved?: boolean;
  createdAt?: string;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  ac: Wind,
  plumbing: Droplets,
  electrical: Zap,
  general: Wrench,
};

const TYPE_LABELS: Record<string, string> = {
  ac: "مكيف الهواء",
  plumbing: "السباكة",
  electrical: "الكهرباء",
  general: "صيانة عامة",
};

function formatArabicDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

type AiReportData = {
  summary: string;
  factors: string[];
  recommendedActions: string[];
  estimatedCostSar: number | null;
  urgentInDays: number | null;
};

export function MaintenancePredictionCard({
  prediction,
  onResolve,
}: {
  prediction: PredictionObject;
  onResolve: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<AiReportData | null>(null);
  const [reportError, setReportError] = React.useState<string | null>(null);
  const [showReport, setShowReport] = React.useState(false);

  const Icon = TYPE_ICONS[prediction.predictedFailureType] ?? Wrench;
  const dateLabel = formatArabicDate(prediction.predictedFailureDate);
  const days = daysUntil(prediction.predictedFailureDate);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/maintenance/predictions/${prediction.id}/resolve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("فشل تحديث الحالة");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] });
      onResolve();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "حدث خطأ"),
  });

  const insightMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/maintenance/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictionId: prediction.id }),
      });
      if (!res.ok) throw new Error("فشل إنشاء التقرير");
      return res.json();
    },
    onSuccess: (result) => {
      if (result?.report) {
        setReport(result.report);
        setReportError(null);
        setShowReport(true);
      } else {
        setReportError(result?.reason ?? "التقرير غير متاح");
      }
    },
    onError: () => setReportError("تعذر الاتصال بخدمة الذكاء الاصطناعي"),
  });

  const toggleReport = () => {
    if (!report) {
      setReportError(null);
      insightMutation.mutate();
      return;
    }
    setShowReport((v) => !v);
  };

  const taskMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `صيانة وقائية - ${prediction.unit.property.name} - وحدة ${prediction.unit.name}`,
          description: `${prediction.suggestedAction} (درجة الخطورة: ${prediction.riskScore})`,
          type: "maintenance",
          property_id: prediction.unit.property.id,
          unit_id: prediction.unit.id,
          due_date: prediction.predictedFailureDate ? prediction.predictedFailureDate.slice(0, 10) : null,
          priority: prediction.riskLevel === "critical" ? "high" : "medium",
          cost_sar: prediction.estimatedCostSar ?? 0,
          extra: { source: "maintenance_ai", prediction_id: prediction.id },
        }),
      });
      if (!res.ok) throw new Error("فشل إنشاء المهمة");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "حدث خطأ"),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-emerald-800/30 dark:bg-[#132a1f]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
            <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-gray-900 dark:text-white">
              <Link href={`/dashboard/properties?property=${prediction.unit.property.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                {prediction.unit.property.name}
              </Link>
              {" — وحدة "}
              <span className="text-indigo-600 dark:text-indigo-400">{prediction.unit.name}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {prediction.predictedFailureTypeLabel ?? TYPE_LABELS[prediction.predictedFailureType] ?? prediction.predictedFailureType}
            </p>
          </div>
        </div>
        <RiskScoreBadge score={prediction.riskScore} level={prediction.riskLevel} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{prediction.suggestedAction}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        {dateLabel ? (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden />
            التاريخ المتوقع: <b className="text-gray-900 dark:text-white">{dateLabel}</b>
          </span>
        ) : null}
        {days !== null && days >= 0 ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${days <= 30 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300"}`}>
            متبقي {days} يوم
          </span>
        ) : null}
        {prediction.estimatedCostSar != null ? (
          <span className="flex items-center gap-1.5">
            <Banknote className="h-4 w-4" aria-hidden />
            التكلفة التقديرية: <b className="text-gray-900 dark:text-white">{prediction.estimatedCostSar.toLocaleString("ar-SA")} ريال</b>
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}

      {showReport && report ? (
        <div className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm dark:border-indigo-800/40 dark:bg-indigo-950/30">
          <p className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            تقرير الذكاء الاصطناعي
          </p>
          <p className="leading-relaxed text-gray-800 dark:text-gray-200">{report.summary}</p>
          {report.factors.length > 0 ? (
            <div>
              <p className="mb-1.5 font-semibold text-gray-700 dark:text-gray-300">أسباب الخطورة:</p>
              <ul className="list-disc space-y-1 pr-5 text-gray-700 dark:text-gray-300">
                {report.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.recommendedActions.length > 0 ? (
            <div>
              <p className="mb-1.5 font-semibold text-gray-700 dark:text-gray-300">الإجراءات الموصى بها:</p>
              <ul className="list-decimal space-y-1 pr-5 text-gray-700 dark:text-gray-300">
                {report.recommendedActions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {report.estimatedCostSar != null ? (
              <span className="flex items-center gap-1">
                <Wallet className="h-4 w-4" aria-hidden />
                التكلفة التقديرية: {report.estimatedCostSar.toLocaleString("ar-SA")} ريال
              </span>
            ) : null}
            {report.urgentInDays != null ? (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden />
                يُنصح بالتدخل خلال {report.urgentInDays} يوم
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {reportError ? (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
          {reportError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleReport}
          disabled={insightMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-l from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles className={`h-4 w-4 ${insightMutation.isPending ? "animate-pulse" : ""}`} aria-hidden />
          {insightMutation.isPending ? "جاري التحليل..." : report ? (showReport ? "إخفاء التقرير" : "عرض التقرير") : "تقرير الذكاء الاصطناعي"}
        </button>
        <button
          type="button"
          onClick={() => taskMutation.mutate()}
          disabled={taskMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
          {taskMutation.isPending ? "جاري الإنشاء..." : "إنشاء مهمة"}
        </button>
        <button
          type="button"
          onClick={() => resolveMutation.mutate()}
          disabled={resolveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:bg-emerald-900/20 dark:text-emerald-400"
        >
          <CheckCircle className="h-4 w-4" aria-hidden />
          تم الحل
        </button>
        <button
          type="button"
          onClick={() => resolveMutation.mutate()}
          disabled={resolveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-emerald-800/50 dark:text-gray-300"
        >
          <XCircle className="h-4 w-4" aria-hidden />
          تجاهل
        </button>
      </div>
    </div>
  );
}
