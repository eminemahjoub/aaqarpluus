"use client";

import * as React from "react";
import { Building, MapPin, Eye } from "lucide-react";
import Link from "next/link";

export function PersonalDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [properties, setProperties] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProperties((data ?? []).slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">لوحة التحكم الشخصية</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">مرحباً — فيما يلي العقارات المتاحة</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-[#132a1f]" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-emerald-800/40 dark:bg-[#132a1f]">
          <Building className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">لا توجد عقارات مسجلة بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const location = [p.city, p.neighborhood].filter(Boolean).join("، ");
            return (
              <div key={p.id} className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <Building className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      {location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="h-3 w-3" />
                          {location}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={["rounded-full px-2 py-0.5 text-xs font-medium", p.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400"].join(" ")}>
                      {p.status === "active" ? "مؤجر" : p.status === "vacant" ? "شاغر" : p.status}
                    </span>
                    <Link
                      href="/dashboard/properties"
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      عرض
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">ابدأ استكشاف المنصة</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          يمكنك تصفح وإدارة العقارات، إنشاء عقود، وتتبع المدفوعات من القائمة الجانبية.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/properties" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            العقارات
          </Link>
          <Link href="/dashboard/contacts" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">
            جهات الاتصال
          </Link>
        </div>
      </div>
    </div>
  );
}
