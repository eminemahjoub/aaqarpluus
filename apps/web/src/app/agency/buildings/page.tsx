"use client";

import * as React from "react";
import { CheckCircle2, X, Building2 } from "lucide-react";
import CreateBuildingForm from "@/components/agency/CreateBuildingForm";
import UnitsList from "@/components/agency/UnitsList";
import { useBuilding } from "@/hooks/useBuilding";
import type { UnitItem } from "@/hooks/useBuilding";
import type { BuildingFormData } from "@/components/agency/CreateBuildingForm";

export default function AgencyBuildingsPage() {
  const {
    createdBuilding,
    error,
    createBuilding,
    isCreating,
    updateUnit,
    isUpdatingUnit,
    reset,
  } = useBuilding();

  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  async function handleCreate(data: BuildingFormData) {
    try {
      const result = await createBuilding(data);
      setSuccessMessage(
        `تم إنشاء المبنى "${result.property.name}" وتوليد ${result.units_generated} وحدة.`
      );
    } catch {
      // error is already set in the hook
    }
  }

  async function handleUpdateUnit(id: string, body: Partial<UnitItem>) {
    await updateUnit({ id, body });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المباني</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          إنشاء مبنى جديد وتوليد وحداته تلقائياً
        </p>
      </div>

      {successMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-md p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error && !createdBuilding ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          إنشاء مبنى جديد
        </h2>
        <CreateBuildingForm onSubmit={handleCreate} isSubmitting={isCreating} />
      </div>

      {createdBuilding ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {createdBuilding.property.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/40 dark:bg-[#1a3528] dark:text-gray-300"
            >
              إنشاء مبنى آخر
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            العنوان: {createdBuilding.property.address}
          </p>

          <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              الوحدات المولدة ({createdBuilding.property.units.length})
            </h3>
            <UnitsList
              units={createdBuilding.property.units}
              onUpdateUnit={handleUpdateUnit}
              isUpdating={isUpdatingUnit}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
