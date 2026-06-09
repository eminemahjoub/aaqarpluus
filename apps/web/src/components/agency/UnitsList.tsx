"use client";

import * as React from "react";
import UnitCard from "./UnitCard";
import type { UnitItem } from "@/hooks/useBuilding";

type Props = {
  units: UnitItem[];
  onUpdateUnit: (id: string, body: Partial<UnitItem>) => void;
  isUpdating?: boolean;
};

export default function UnitsList({ units, onUpdateUnit, isUpdating }: Props) {
  const apartments = units.filter((u) => u.unit_type === "appartement");
  const shops = units.filter((u) => u.unit_type === "magasin");

  return (
    <div className="space-y-6">
      {apartments.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            الشقق ({apartments.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apartments.map((u) => (
              <UnitCard key={u.id} unit={u} onSave={onUpdateUnit} isSaving={isUpdating} />
            ))}
          </div>
        </div>
      )}

      {shops.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            المحلات ({shops.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((u) => (
              <UnitCard key={u.id} unit={u} onSave={onUpdateUnit} isSaving={isUpdating} />
            ))}
          </div>
        </div>
      )}

      {units.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-emerald-800/30 dark:text-gray-400">
          لا توجد وحدات مولدة بعد.
        </div>
      )}
    </div>
  );
}
