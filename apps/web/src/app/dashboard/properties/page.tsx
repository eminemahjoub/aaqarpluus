"use client";

import { useState } from "react";
import { useCanMutate } from "@/hooks/useCanMutate";
import { PropertyList } from "@/components/properties/PropertyList";
import {
  PropertyForm,
  type PropertyFormData,
} from "@/components/properties/PropertyForm";
import { PropertyDetailDrawer } from "@/components/properties/PropertyDetailDrawer";
import {
  usePropertyMutations,
  type Property,
} from "@/app/dashboard/properties/hooks/useProperties";
import { frequencyToEnglish } from "@/lib/validation/contracts";

/**
 * Properties page (Day 5) — composition shell over the extracted components.
 *
 * NOTE: contains no inline contracts/payments/expenses/document flows — the
 * legacy monolith's interaction modals were dropped in the extraction; those
 * flows return via the drawer's onAddUnit/onUploadImages and future panels.
 */

function propertyToFormData(p: Property): Partial<PropertyFormData> {
  return {
    owner_id: (p as any).owner_id ?? undefined,
    title: (p.title ?? p.name) ?? "",
    region: p.region ?? "",
    city: p.city ?? "",
    neighborhood: p.neighborhood ?? "",
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    area_m2: p.area_m2 ?? undefined,
    floors_count: p.floors_count ?? undefined,
    apartments_count: (p as any).apartments_count ?? undefined,
    shops_count: (p as any).shops_count ?? undefined,
    other_units_count: (p as any).other_units_count ?? undefined,
    payment_frequency:
      (frequencyToEnglish(p.payment_frequency as string | null | undefined) as PropertyFormData["payment_frequency"]) ??
      "monthly",
    lessor_type: p.lessor_type ?? "",
    commission_percent: p.commission_percent ?? undefined,
    water_account: p.water_account ?? "",
    electricity_account: p.electricity_account ?? "",
    title_deed_number: p.title_deed_number ?? "",
  };
}

export function PropertiesContent() {
  const { userType, canMutateProperties } = useCanMutate();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const { create, update } = usePropertyMutations(String(userType || "session"));

  const canAdd = canMutateProperties;

  const handleSubmit = async (data: PropertyFormData) => {
    const body: Record<string, unknown> = {
      owner_id: data.owner_id || undefined,
      name: data.title,
      title: data.title,
      region: data.region ?? null,
      city: data.city ?? null,
      neighborhood: data.neighborhood ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      area_m2: data.area_m2,
      floors_count: data.floors_count,
      apartments_count: data.apartments_count ?? 0,
      shops_count: data.shops_count ?? 0,
      other_units_count: data.other_units_count ?? 0,
      payment_frequency: data.payment_frequency,
      lessor_type:
        data.lessor_type && ["office", "owner"].includes(data.lessor_type) ? data.lessor_type : null,
      commission_percent: data.commission_percent,
      water_account: data.water_account ?? null,
      electricity_account: data.electricity_account ?? null,
      title_deed_number: data.title_deed_number ?? null,
    };

    if (editingProperty) {
      await update.mutateAsync({ id: editingProperty.id, body });
    } else {
      await create.mutateAsync(body);
    }
    setShowForm(false);
    setEditingProperty(null);
  };

  return (
    <div dir="rtl" className="container mx-auto py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">العقارات</h1>
      <PropertyList
        officeId={String(userType || "session")}
        onSelect={(p) => setSelectedProperty(p)}
        onAdd={canAdd ? () => setShowForm(true) : undefined}
      />
      <PropertyForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingProperty(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingProperty ? propertyToFormData(editingProperty) : undefined}
        isSubmitting={create.isPending || update.isPending}
        userType={userType}
      />
      <PropertyDetailDrawer
        propertyId={selectedProperty?.id ?? ""}
        open={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onEdit={(p) => {
          setEditingProperty(p);
          setShowForm(true);
        }}
      />
    </div>
  );
}

export default function PropertiesPage() {
  return <PropertiesContent />;
}