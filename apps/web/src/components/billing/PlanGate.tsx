"use client";

import Link from "next/link";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const COMPARISON = [
  { feature: "EJAR والربط الحكومي", free: "—", paid: "متاح" },
  { feature: "فواتير ZATCA", free: "—", paid: "متاح" },
  { feature: "رسائل SMS", free: "—", paid: "متاح" },
  { feature: "بوابة المالك + كشف الهويات", free: "—", paid: "Growth+" },
  { feature: "API والعلامة المخصصة", free: "—", paid: "Pro" },
];

/** Shown when a user hits a plan-gated feature. CTA → billing page. */
export function PlanGate({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex w-full items-start justify-between">
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ميزة مدفوعة
              </span>
            </DialogTitle>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {feature
            ? `هذه الميزة (${feature}) غير متاحة في باقتك الحالية.`
            : "هذه الميزة غير متاحة في باقتك الحالية."}
        </p>
        <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{row.feature}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{row.free}</td>
                  <td className="px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            لاحقاً
          </Button>
          <Link href="/dashboard/billing">
            <Button type="button">ترقية الاشتراك</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}