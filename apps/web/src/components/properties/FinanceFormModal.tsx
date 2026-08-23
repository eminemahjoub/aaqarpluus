"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "check", label: "شيك" },
  { value: "card", label: "بطاقة" },
  { value: "other", label: "أخرى" },
];

export function FinanceFormModal({
  open,
  onClose,
  propertyId,
  mode,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  mode: "expense" | "revenue";
  onSaved: () => void;
}) {
  const isExpense = mode === "expense";
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(isExpense ? "/api/expenses" : "/api/revenues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          type: type.trim() || (isExpense ? "مصروف عام" : "إيراد عام"),
          amount_sar: amt,
          payment_method: method,
          [isExpense ? "paid_at" : "received_at"]: date ? new Date(`${date}T12:00:00`).toISOString() : null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(String(errBody?.error ?? "تعذر الحفظ"));
        return;
      }
      onSaved();
      onClose();
      setType("");
      setAmount("");
      setMethod("cash");
      setDate("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isExpense ? "إضافة مصروف" : "إضافة إيراد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>النوع</Label>
              <Input value={type} onChange={(e) => setType(e.target.value)} placeholder={isExpense ? "صيانة" : "إيجار"} />
            </div>
            <div>
              <Label>المبلغ (ر.س) *</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>طريقة الدفع</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{isExpense ? "تاريخ الصرف" : "تاريخ الاستلام"}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>وصف</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="—" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}