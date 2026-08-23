"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth-fetch";

const FREQUENCIES = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "biannual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

type Unit = { id: string; label: string };
type Contact = { id: string; name: string; phone: string | null };

export type ContractEditData = {
  id: string;
  unit_id?: string | null;
  contact_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  rent_total_sar?: number | null;
  payment_frequency?: string | null;
  installments_count?: number | null;
  notes?: string | null;
};

export function ContractFormModal({
  open,
  onClose,
  propertyId,
  onSaved,
  initialContract,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onSaved: () => void;
  initialContract?: ContractEditData;
}) {
  const isEdit = Boolean(initialContract);
  const [unitId, setUnitId] = useState("");
  const [contactId, setContactId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentTotal, setRentTotal] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [installments, setInstallments] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialContract) {
      // Intentional form reset when the modal opens with edit data.
      // Remount-on-open would be the alternative; this is deliberate UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnitId(initialContract.unit_id ?? "");
      setContactId(initialContract.contact_id ?? "");
      setStartDate(initialContract.start_date ?? "");
      setEndDate(initialContract.end_date ?? "");
      setRentTotal(initialContract.rent_total_sar != null ? String(initialContract.rent_total_sar) : "");
      setFrequency(
        initialContract.payment_frequency &&
          FREQUENCIES.some((f) => f.value === initialContract.payment_frequency)
          ? initialContract.payment_frequency
          : "monthly"
      );
      setInstallments(initialContract.installments_count != null ? String(initialContract.installments_count) : "");
      setNotes(initialContract.notes ?? "");
    }
  }, [open, initialContract]);

  const { data: units, isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["units-by-property", propertyId],
    queryFn: async () => {
      const res = await authFetch(`/api/units?property_id=${encodeURIComponent(propertyId)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["contracts-contacts"],
    queryFn: async () => {
      const res = await authFetch("/api/contacts");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rent = Number(rentTotal);
    if (!rent || rent <= 0) {
      setError("قيمة الإيجار يجب أن تكون أكبر من صفر");
      return;
    }
    setSubmitting(true);
    try {
      const res = isEdit && initialContract
        ? await authFetch(`/api/contracts/${encodeURIComponent(initialContract.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start_date: startDate || null,
              end_date: endDate || null,
              rent_total_sar: rent,
              payment_frequency: frequency,
              installments_count: installments ? Number(installments) : null,
              notes: notes.trim() || null,
            }),
          })
        : await authFetch("/api/contracts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              property_id: propertyId,
              unit_id: unitId || null,
              contact_id: contactId || null,
              start_date: startDate || null,
              end_date: endDate || null,
              rent_total_sar: rent,
              payment_frequency: frequency,
              installments_count: installments ? Number(installments) : null,
              status: "active",
              notes: notes.trim() || null,
            }),
          });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const details = errBody?.details?.[0]?.message;
        setError(String(details ?? errBody?.error ?? "تعذر إضافة العقد"));
        return;
      }
      onSaved();
      onClose();
      setUnitId("");
      setContactId("");
      setStartDate("");
      setEndDate("");
      setRentTotal("");
      setFrequency("monthly");
      setInstallments("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تحديث العقد" : "إضافة عقد"}</DialogTitle>
        </DialogHeader>
        {unitsLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الوحدة</Label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">اختر الوحدة</option>
                  {(units ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>المستأجر</Label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">اختر المستأجر</option>
                  {(contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>بداية العقد</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>نهاية العقد</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الإيجار الإجمالي (ر.س) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={rentTotal}
                  onChange={(e) => setRentTotal(e.target.value)}
                  placeholder="300000"
                />
              </div>
              <div>
                <Label>تكرار الدفع</Label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>عدد الدفعات</Label>
                <Input
                  type="number"
                  min={1}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  placeholder="12"
                />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="—" />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "جاري الحفظ..." : isEdit ? "حفظ التحديثات" : "إضافة العقد"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}