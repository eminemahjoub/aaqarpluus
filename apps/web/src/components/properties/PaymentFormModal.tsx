"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";

type Contract = { id: string; unit?: { label?: string } | null; contact?: { name?: string } | null };

export function PaymentFormModal({
  open,
  onClose,
  propertyId,
  onSaved,
  initialPayment,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onSaved: () => void;
  initialPayment?: { contract_id?: string; amount_sar?: number; due_date?: string } | null;
}) {
  const [contractId, setContractId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialPayment) {
      // Intentional form reset when the modal opens with prefill data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContractId(initialPayment.contract_id ?? "");
      setAmount(initialPayment.amount_sar != null ? String(initialPayment.amount_sar) : "");
      setDueDate(initialPayment.due_date ?? "");
    }
  }, [open, initialPayment]);

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["active-contracts", propertyId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/contracts?property_id=${encodeURIComponent(propertyId)}&status=active`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contractId) {
      setError("اختر العقد");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/contract-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          amount_sar: amt,
          due_date: dueDate || null,
          status,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(String(errBody?.error ?? "تعذر تسجيل الدفعة"));
        return;
      }
      onSaved();
      onClose();
      setContractId("");
      setAmount("");
      setDueDate("");
      setStatus("pending");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>العقد *</Label>
            <select
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">اختر العقد</option>
              {(contracts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.unit?.label ?? "—"} — {c.contact?.name ?? "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>المبلغ (ر.س) *</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div>
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>الحالة</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="pending">مستحق</option>
              <option value="paid">مدفوع</option>
            </select>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="—" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ..." : "تسجيل"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}