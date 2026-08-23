"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";

const UNIT_TYPES = [
  { value: "apartment", label: "شقة" },
  { value: "shop", label: "محل" },
  { value: "other", label: "أخرى" },
];

export function UnitFormModal({
  open,
  onClose,
  propertyId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [unitType, setUnitType] = useState("apartment");
  const [floor, setFloor] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [rent, setRent] = useState("");
  const [status, setStatus] = useState("vacant");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("اسم الوحدة مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          label: label.trim(),
          unit_type: unitType,
          floor: floor.trim() || null,
          area_sqm: areaSqm ? Number(areaSqm) : null,
          rent_amount: rent ? Number(rent) : null,
          status,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(String(errBody?.error ?? "تعذر إضافة الوحدة"));
        return;
      }
      onSaved();
      onClose();
      setLabel("");
      setUnitType("apartment");
      setFloor("");
      setAreaSqm("");
      setRent("");
      setStatus("vacant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة وحدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>اسم الوحدة *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="شقة 3" />
            </div>
            <div>
              <Label>النوع</Label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {UNIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الدور</Label>
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="1" />
            </div>
            <div>
              <Label>المساحة (م²)</Label>
              <Input
                type="number"
                min={0}
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الإيجار (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder="30000"
              />
            </div>
            <div>
              <Label>الحالة</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="vacant">شاغرة</option>
                <option value="occupied">مأهولة</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}