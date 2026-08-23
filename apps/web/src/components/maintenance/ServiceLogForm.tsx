"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function ServiceLogForm({ unitId, onSuccess }: { unitId: string; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [acDate, setAcDate] = React.useState("");
  const [plumbingDate, setPlumbingDate] = React.useState("");
  const [electricalDate, setElectricalDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (acDate) body.last_ac_service_date = acDate;
      if (plumbingDate) body.last_plumbing_check_date = plumbingDate;
      if (electricalDate) body.last_electrical_check_date = electricalDate;
      if (Object.keys(body).length === 0) throw new Error("اختر تاريخاً واحداً على الأقل");
      const res = await authFetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("فشل حفظ التواريخ");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["unit", "maintenance", unitId] });
      void queryClient.invalidateQueries({ queryKey: ["maintenance", "predictions"] });
      onSuccess();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "حدث خطأ"),
  });

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ac-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          تاريخ صيانة المكيف
        </label>
        <input
          id="ac-date"
          type="date"
          value={acDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setAcDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
        />
      </div>
      <div>
        <label htmlFor="plumbing-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          تاريخ فحص السباكة
        </label>
        <input
          id="plumbing-date"
          type="date"
          value={plumbingDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setPlumbingDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
        />
      </div>
      <div>
        <label htmlFor="electrical-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          تاريخ الفحص الكهربائي
        </label>
        <input
          id="electrical-date"
          type="date"
          value={electricalDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setElectricalDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
        />
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden />
        {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
      </button>
    </div>
  );
}
