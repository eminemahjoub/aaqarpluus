"use client";

import * as React from "react";
import { Pencil, Save, X, Home, Store } from "lucide-react";
import type { UnitItem } from "@/hooks/useBuilding";

type Props = {
  unit: UnitItem;
  onSave: (id: string, body: Partial<UnitItem>) => void;
  isSaving?: boolean;
};

export default function UnitCard({ unit, onSave, isSaving }: Props) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    area_sqm: unit.area_sqm ?? "",
    rent_amount: unit.rent_amount ?? "",
    description: unit.description ?? "",
  });

  React.useEffect(() => {
    setForm({
      area_sqm: unit.area_sqm ?? "",
      rent_amount: unit.rent_amount ?? "",
      description: unit.description ?? "",
    });
  }, [unit]);

  const isApartment = unit.unit_type === "appartement";
  const icon = isApartment ? <Home className="h-4 w-4" /> : <Store className="h-4 w-4" />;
  const typeLabel = isApartment ? "شقة" : "محل";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{unit.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {typeLabel} — طابق {unit.floor ?? "—"}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            unit.status === "vacant"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          }`}
        >
          {unit.status === "vacant" ? "متاح" : unit.status}
        </span>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">المساحة (م²)</label>
              <input
                type="number"
                value={form.area_sqm}
                onChange={(e) => setForm((f) => ({ ...f, area_sqm: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                placeholder="120"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الإيجار الأساسي</label>
              <input
                type="number"
                value={form.rent_amount}
                onChange={(e) => setForm((f) => ({ ...f, rent_amount: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                placeholder="5000"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الوصف</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              placeholder="وصف الوحدة..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                onSave(unit.id, {
                  area_sqm: form.area_sqm === "" ? null : Number(form.area_sqm),
                  rent_amount: form.rent_amount === "" ? null : Number(form.rent_amount),
                  description: form.description || null,
                });
                setIsEditing(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/40 dark:bg-[#1a3528] dark:text-gray-300"
            >
              <X className="h-3.5 w-3.5" />
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span className="text-gray-500 dark:text-gray-500">المساحة:</span>{" "}
            {unit.area_sqm ? `${unit.area_sqm} م²` : "—"}
          </p>
          <p>
            <span className="text-gray-500 dark:text-gray-500">الإيجار:</span>{" "}
            {unit.rent_amount ? `${unit.rent_amount} ر.س` : "—"}
          </p>
          {unit.description ? <p className="text-xs text-gray-500 dark:text-gray-500">{unit.description}</p> : null}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            تعديل
          </button>
        </div>
      )}
    </div>
  );
}
