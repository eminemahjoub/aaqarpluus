"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

export type UnitItem = {
  id: string;
  label: string;
  unit_type: string;
  floor: string | null;
  area_sqm: number | null;
  rent_amount: number | null;
  status: string;
  description: string | null;
};

export type BuildingResult = {
  property: {
    id: string;
    name: string;
    address: string | null;
    floors_count: number;
    units: UnitItem[];
  } & Record<string, any>;
  units_generated: number;
};

export type BuildingFormData = {
  name: string;
  address: string;
  floors_count: number;
  apartments_per_floor: number;
  shops_count: number;
  shops_per_floor: boolean;
  property_model_type: "residential" | "commercial" | "mixed";
  owner_id?: string;
};

export function useBuilding() {
  const qc = useQueryClient();
  const [createdBuilding, setCreatedBuilding] = React.useState<BuildingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: BuildingFormData) => {
      const res = await authFetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "فشل إنشاء المبنى");
      }
      return res.json() as Promise<BuildingResult>;
    },
    onSuccess: (data) => {
      setCreatedBuilding(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ["agency", "properties"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "properties"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<UnitItem> }) => {
      const res = await authFetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "فشل تحديث الوحدة");
      }
      return res.json() as Promise<UnitItem>;
    },
    onSuccess: (updated) => {
      setCreatedBuilding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          property: {
            ...prev.property,
            units: prev.property.units.map((u) => (u.id === updated.id ? updated : u)),
          },
        };
      });
    },
  });

  return {
    createdBuilding,
    error,
    createBuilding: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateUnit: updateUnitMutation.mutateAsync,
    isUpdatingUnit: updateUnitMutation.isPending,
    reset: () => {
      setCreatedBuilding(null);
      setError(null);
    },
  };
}
