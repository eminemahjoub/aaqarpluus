"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Receipt, FileDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ReceiptItem = {
  id: string;
  amount_sar: number;
  paid_at: string | null;
  payment_method: string;
  unit_label: string | null;
  property_title: string;
  property_city: string | null;
  receipt_url: string | null;
};

const formatCurrency = (v: number) => `${v.toLocaleString("ar-SA")} ر.س`;

const formatDate = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ar-SA");
};

export default function TenantReceiptsPage() {
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<ReceiptItem[]>({
    queryKey: ["tenant-receipts"],
    queryFn: async () => {
      const res = await fetch("/api/tenant/receipts", { credentials: "include" });
      if (res.status === 401) {
        router.push("/tenant/login");
        throw new Error("unauthorized");
      }
      if (!res.ok) throw new Error("فشل تحميل الإيصالات");
      return res.json();
    },
  });

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-[#0f1e14] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">إيصالات السداد</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              إيصالات الدفعات المسددة على عقودك
            </p>
          </div>
          <Link
            href="/tenant/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowRight className="h-4 w-4" />
            لوحة التحكم
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              حدث خطأ أثناء تحميل الإيصالات
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Receipt className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">لا توجد إيصالات</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ستظهر هنا إيصالات الدفعات المسددة تلقائياً
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (data?.length ?? 0) > 0 && (
          <div className="space-y-4">
            {data!.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(r.amount_sar)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {r.property_title}
                        {r.unit_label ? ` — ${r.unit_label}` : ""}
                      </p>
                      {r.property_city && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{r.property_city}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>تاريخ السداد: {formatDate(r.paid_at)}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                          {r.payment_method}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`/api/receipts/${r.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <FileDown className="h-4 w-4" />
                      تحميل
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
