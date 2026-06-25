"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TenantDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/tenant/me", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/tenant/login");
            return;
          }
          throw new Error("فشل تحميل البيانات");
        }
        const data = await res.json();
        setTenant(data.tenant);
        setContract(data.contract);
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-[#0f1e14]">
        <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f1e14]">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-[#0f1e14]" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة المستأجر</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/tenant/profile"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:text-gray-300 dark:hover:bg-[#1a3528]"
            >
              الملف الشخصي
            </Link>
            <Link
              href="/tenant/maintenance"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              طلب صيانة
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">بيانات المستأجر</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">الاسم</span>
              <p className="font-medium text-gray-900 dark:text-white">{tenant?.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">رقم الجوال</span>
              <p className="font-medium text-gray-900 dark:text-white" dir="ltr">{tenant?.phone}</p>
            </div>
          </div>
        </div>

        {contract ? (
          <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">تفاصيل العقد</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">العقار</span>
                <p className="font-medium text-gray-900 dark:text-white">{contract.propertyName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">الوحدة</span>
                <p className="font-medium text-gray-900 dark:text-white">{contract.unitLabel}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">بداية العقد</span>
                <p className="font-medium text-gray-900 dark:text-white">{contract.startDate}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">نهاية العقد</span>
                <p className="font-medium text-gray-900 dark:text-white">{contract.endDate}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">قيمة الإيجار</span>
                <p className="font-medium text-gray-900 dark:text-white">{contract.rentTotalSar.toLocaleString()} ر.س</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
