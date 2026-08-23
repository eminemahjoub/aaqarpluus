"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

export interface PropertyImage {
  id: string;
  public_url: string;
  image_type: string;
  unit_id?: string | null;
  component_id?: string | null;
}

export interface Unit {
  id: string;
  label: string;
  unit_type: string;
  floor?: string | null;
  area_sqm?: number | null;
  rent_amount?: number | null;
  status: string;
}

export interface ContractSummary {
  id: string;
  contract_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_total_sar?: number | null;
  payment_frequency?: string | null;
  status: string;
}

export interface Revenue {
  id: string;
  type?: string | null;
  amount_sar: number;
  payment_method?: string | null;
  received_at?: string | null;
}

export interface Expense {
  id: string;
  type?: string | null;
  amount_sar: number;
  payment_method?: string | null;
  paid_at?: string | null;
}

export interface Property {
  id: string;
  name?: string;
  title?: string | null;
  region?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area_m2?: number | null;
  property_cost?: number | null;
  floors_count?: number | null;
  units_count?: number | null;
  status: string;
  payment_frequency?: string | null;
  lessor_type?: string | null;
  commission_percent?: number | null;
  water_account?: string | null;
  electricity_account?: string | null;
  title_deed_number?: string | null;
  cover_url?: string | null;
  owner_name?: string | null;
  managing_office_name?: string | null;
  /** List view only carries cover_url; full images come from /api/property-images */
  images?: PropertyImage[];
  units?: Unit[];
  contracts?: ContractSummary[];
  revenues?: Revenue[];
  expenses?: Expense[];
}

/** List endpoint scoping comes from the session JWT — officeId is kept for the query key. */
export function useProperties(officeId: string) {
  return useQuery<Property[]>({
    queryKey: ["properties", officeId],
    queryFn: async () => {
      const res = await authFetch(`/api/properties?officeId=${encodeURIComponent(officeId)}`);
      if (!res.ok) throw new Error("فشل تحميل العقارات");
      return res.json();
    },
    enabled: Boolean(officeId),
  });
}

export function useProperty(id: string) {
  return useQuery<Property>({
    queryKey: ["property", id],
    queryFn: async () => {
      const res = await authFetch(`/api/properties/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("فشل تحميل العقار");
      return res.json();
    },
    enabled: Boolean(id),
  });
}

export function usePropertyMutations(officeId: string) {
  const queryClient = useQueryClient();

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["properties", officeId] });
  };

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("فشل إنشاء العقار");
      return res.json();
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await authFetch(`/api/properties/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("فشل تحديث العقار");
      return res.json();
    },
    onSuccess: async (_data, { id }) => {
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
      await invalidateAll();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/properties/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("فشل حذف العقار");
      return res.json();
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  return { create, update, remove };
}