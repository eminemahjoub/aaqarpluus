"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import Link from "next/link";

type BillingSummary = {
  plan: {
    id: string;
    name_ar: string;
    price_sar: number;
    unit_limit: number | null;
    status: string | null;
    trial_ends_at: string | null;
    period_ends_at: string | null;
  };
  usage: { units: number };
  invoices: {
    id: string;
    plan_id: string;
    amount_sar: number;
    tax_sar: number;
    total_sar: number;
    status: string;
    due_date: string;
    paid_at: string | null;
    zatca_number: string | null;
    zatca_invoice_id: string | null;
  }[];
};

const PLANS = [
  { id: "starter", name: "البداية", price: 49, desc: "10 وحدات" },
  { id: "growth", name: "النمو", price: 199, desc: "50 وحدة" },
  { id: "pro", name: "احترافي", price: 9, desc: "لكل وحدة" },
];

const STATUS_VARIANT: Record<string, BadgeVariant> = { paid: "green", open: "amber", draft: "gray" };

export default function BillingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BillingSummary>({
    queryKey: ["billing-summary"],
    queryFn: async () => {
      const res = await authFetch("/api/billing/invoices");
      if (!res.ok) throw new Error("فشل تحميل الفوترة");
      return res.json();
    },
  });

  const inTrial = data?.plan.status === "trialing";
  const usagePct = (() => {
    if (!data) return 0;
    if (!data.plan.unit_limit) return 100;
    return Math.min(100, Math.round((data.usage.units / data.plan.unit_limit) * 100));
  })();

  const subscribe = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: selectedPlan, payment_token: token || undefined, is_yearly: false }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(String(body?.error ?? body?.details?.message ?? "تعذر الاشتراك"));
        return;
      }
      setMsg(String(body?.message ?? "تم الاشتراك"));
      setUpgradeOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="container mx-auto max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الفوترة والاشتراك</h1>
        <Button type="button" onClick={() => setUpgradeOpen(true)}>
          <CreditCard className="h-4 w-4" />
          ترقية
        </Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}

      {data && (
        <>
          {inTrial && data.plan.trial_ends_at && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              فترة التجربة تنتهي في {new Date(data.plan.trial_ends_at).toLocaleDateString("ar-SA")} —
              تتحول تلقائياً إلى الباقة المجانية إذا لم تُفعّل.
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">{data.plan.name_ar}</CardTitle>
              <Badge variant={inTrial ? "amber" : "green"}>
                {data.plan.status === "trialing" ? "تجربة" : data.plan.status === "active" ? "نشط" : data.plan.status ?? "مجاني"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.plan.price_sar || 0} ر.س<span className="text-sm font-normal text-gray-400">/شهرياً</span>
              </p>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>استخدام الوحدات: {data.usage.units}</span>
                  <span>{data.plan.unit_limit ? `الحد ${data.plan.unit_limit}` : "غير محدود"}</span>
                </div>
                {data.plan.unit_limit && (
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">الفواتير</CardTitle>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">لا توجد فواتير بعد</p>
              )}
              <div className="space-y-2">
                {data.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(inv.due_date).toLocaleDateString("ar-SA")} — {inv.total_sar.toLocaleString("ar-SA")} ر.س
                      </p>
                      {inv.zatca_number && (
                        <a
                          href={`/api/zatca/invoices/${inv.zatca_invoice_id}/xml`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {inv.zatca_number} (XML)
                        </a>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "gray"}>
                      {inv.status === "paid" ? "مدفوع" : inv.status === "open" ? "مستحق" : "مسودة"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ترقية الاشتراك</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlan(p.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-right ${
                  selectedPlan === p.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <span>
                  <span className="block font-medium text-gray-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</span>
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">{p.price} ر.س</span>
              </button>
            ))}
            <div>
              <Label>بطاقة (Tap)</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="tok_test_... (مفتاح بيئة التجربة)"
                dir="ltr"
              />
            </div>
            {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setUpgradeOpen(false)}>
                إلغاء
              </Button>
              <Button type="button" onClick={subscribe} disabled={submitting}>
                {submitting ? "جارٍ الاشتراك..." : "بدء فترة التجربة"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              <Sparkles className="inline h-3 w-3" /> 14 يوماً تجربة مجانية — بدون بطاقة. تمر عبر بوابة Tap عند التفعيل.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-center">
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          العودة للوحة التحكم
        </Link>
      </p>
    </div>
  );
}