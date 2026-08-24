"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useCanMutate } from "@/hooks/useCanMutate";
import { PropertyList } from "@/components/properties/PropertyList";
import {
  PropertyForm,
  type PropertyFormData,
} from "@/components/properties/PropertyForm";
import { PropertyDetailDrawer } from "@/components/properties/PropertyDetailDrawer";
import { UnitFormModal } from "@/components/properties/UnitFormModal";
import {
  ContractFormModal,
  type ContractEditData,
} from "@/components/properties/ContractFormModal";
import { PaymentFormModal } from "@/components/properties/PaymentFormModal";
import { FinanceFormModal } from "@/components/properties/FinanceFormModal";
import { ImageUploadModal } from "@/components/properties/ImageUploadModal";
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
    description: (p as any).description ?? "",
  };
}

export function PropertiesContent() {
  const { userType, canMutateProperties } = useCanMutate();
  const queryClient = useQueryClient();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractEditData | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    contract_id?: string;
    amount_sar?: number;
    due_date?: string;
  } | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const { create, update } = usePropertyMutations(String(userType || "session"));

  const canAdd = canMutateProperties;

  const refreshTop = async () => {
    await queryClient.invalidateQueries({ queryKey: ["property", selectedProperty?.id] });
    await queryClient.invalidateQueries({ queryKey: ["property-images", selectedProperty?.id] });
    await queryClient.invalidateQueries({ queryKey: ["contract-payments"] });
    await queryClient.invalidateQueries({ queryKey: ["properties", String(userType || "session")] });
  };

  const refreshDrawer = async () => {
    await queryClient.invalidateQueries({ queryKey: ["property", selectedProperty?.id] });
    await queryClient.invalidateQueries({ queryKey: ["contract-payments"] });
  };

  const handleEditContract = (contract: ContractEditData) => {
    setEditingContract(contract);
    setShowContractModal(true);
  };

  const handleTerminateContract = async (contract: ContractEditData) => {
    try {
      const res = await authFetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Free the unit (the PUT sync only marks the property vacant)
      if (contract.unit_id) {
        await authFetch(`/api/units/${encodeURIComponent(contract.unit_id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "vacant" }),
        });
      }
      await refreshDrawer();
    } catch {
      window.alert("تعذر إنهاء العقد");
    }
  };

  const handleCancelContract = async (contract: ContractEditData) => {
    try {
      const res = await authFetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshDrawer();
    } catch {
      window.alert("تعذر إلغاء العقد");
    }
  };

  const handleRegisterPayment = (contract: ContractEditData, amount?: number, dueDate?: string) => {
    setPendingPayment({ contract_id: contract.id, amount_sar: amount, due_date: dueDate });
    setShowPaymentModal(true);
  };

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
      description: data.description ?? null,
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
        onAddUnit={() => setShowUnitModal(true)}
        onUploadImages={() => setShowImageModal(true)}
        onAddContract={() => setShowContractModal(true)}
        onAddPayment={() => setShowPaymentModal(true)}
        onAddExpense={() => setShowExpenseModal(true)}
        onAddRevenue={() => setShowRevenueModal(true)}
        onEditContract={handleEditContract}
        onTerminateContract={handleTerminateContract}
        onCancelContract={handleCancelContract}
        onRegisterPayment={handleRegisterPayment}
        isOwner={userType === "owner" || userType === "personal"}
      />

      {selectedProperty && (
        <>
          <UnitFormModal
            open={showUnitModal}
            onClose={() => setShowUnitModal(false)}
            propertyId={selectedProperty.id}
            onSaved={refreshTop}
          />
          <ContractFormModal
            open={showContractModal}
            onClose={() => {
              setShowContractModal(false);
              setEditingContract(null);
            }}
            propertyId={selectedProperty.id}
            onSaved={refreshDrawer}
            initialContract={editingContract ?? undefined}
          />
          <PaymentFormModal
            open={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            propertyId={selectedProperty.id}
            onSaved={refreshTop}
            initialPayment={pendingPayment}
          />
          <FinanceFormModal
            open={showExpenseModal}
            onClose={() => setShowExpenseModal(false)}
            propertyId={selectedProperty.id}
            mode="expense"
            onSaved={refreshTop}
          />
          <FinanceFormModal
            open={showRevenueModal}
            onClose={() => setShowRevenueModal(false)}
            propertyId={selectedProperty.id}
            mode="revenue"
            onSaved={refreshTop}
          />
          <ImageUploadModal
            open={showImageModal}
            onClose={() => setShowImageModal(false)}
            propertyId={selectedProperty.id}
            onSaved={refreshTop}
          />
        </>
      )}
    </div>
  );
}

export default function PropertiesPage() {
  return <PropertiesContent />;
}