"use client";

import * as React from "react";
import { Wrench, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { RiskScoreBadge } from "./RiskScoreBadge";
import { ServiceLogForm } from "./ServiceLogForm";

type UnitRisk = {
  riskScore: number;
  riskLevel: string;
  predictedFailureType: string;
  predictedFailureDate: string | null;
  suggestedAction: string;
  lastAcServiceDate: string | null;
  lastPlumbingCheckDate: string | null;
  lastElectricalCheckDate: string | null;
};

function serviceDateStatus(date: string | null, maxMonths: number): "ok" | "overdue" | "none" {
  if (!date) return "none";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "none";
  const months = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return months <= maxMonths ? "ok" : "overdue";
}

const DATE_LABELS: Array<{ key: keyof UnitRisk; label: string; maxMonths: number }> = [
  { key: "lastAcServiceDate", label: "صيانة المكيف", maxMonths: 12 },
  { key: "lastPlumbingCheckDate", label: "فحص السباكة", maxMonths: 18 },
  { key: "lastElectricalCheckDate", label: "الفحص الكهربائي", maxMonths: 24 },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function UnitMaintenanceWidget({ unitId }: { unitId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);

  const { data: risk, isLoading } = useQuery<UnitRisk>({
    queryKey: ["unit", "maintenance", unitId],
    queryFn: async () => {
      const res = await authFetch(`/api/units/${unitId}/maintenance-risk`);
      if (!res.ok) throw new Error("فشل تحميل حالة الصيانة");
      return res.json();
    },
  });

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-emerald-800/30 dark:bg-[#0f1e14]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
          <Wrench className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
          حالة الصيانة الوقائية
        </p>
        {isLoading ? (
          <span className="text-xs text-gray-400">جاري التحميل...</span>
        ) : risk ? (
          <RiskScoreBadge score={risk.riskScore} level={risk.riskLevel} />
        ) : null}
      </div>

      {risk && (
        <ul className="mt-2 space-y-1.5">
          {DATE_LABELS.map((item) => {
            const value = risk[item.key] as string | null;
            const status = serviceDateStatus(value, item.maxMonths);
            const dot = status === "ok" ? "bg-emerald-500" : status === "overdue" ? "bg-red-500" : "bg-gray-400";
            const color = status === "ok" ? "text-emerald-700 dark:text-emerald-400" : status === "overdue" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400";
            return (
              <li key={item.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
                  {item.label}
                </span>
                <span className={`font-semibold ${color}`}>{formatDate(value)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {risk?.suggestedAction ? (
        <p className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600 dark:bg-[#1a3528] dark:text-gray-300">
          {risk.suggestedAction}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
      >
        تسجيل صيانة
      </button>

      {showForm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#132a1f]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">تسجيل صيانة — وحدة {unitId.slice(0, 8)}</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <ServiceLogForm
              unitId={unitId}
              onSuccess={() => {
                setShowForm(false);
                void queryClient.invalidateQueries({ queryKey: ["unit", "maintenance", unitId] });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
