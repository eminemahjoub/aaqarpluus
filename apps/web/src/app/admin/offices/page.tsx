"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

type OfficeRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  license: string | null;
  is_active: boolean;
  owners_count: number;
  properties_count: number;
  created_at: string | null;
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number; search?: string };

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminOfficesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"" | "active" | "inactive">("");
  const [page, setPage] = React.useState(1);

  const q = useQuery({
    queryKey: ["admin", "offices", { search, status, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", "25");
      if (search.trim()) sp.set("search", search.trim());
      if (status) sp.set("status", status);
      const res = await authFetch(`/api/admin/offices?${sp.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل المكاتب");
      }
      return (await res.json()) as Paged<OfficeRow>;
    },
    placeholderData: (prev) => prev,
  });

  const toggle = useMutation({
    mutationFn: async (o: OfficeRow) => {
      const res = await authFetch(`/api/admin/offices/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !o.is_active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر التحديث");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "offices"] });
    },
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const data = q.data!;
  const items = data.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">المكاتب</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">قائمة المكاتب + إحصائيات + تفعيل/تعطيل.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220] md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">بحث</label>
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="اسم / إيميل / هاتف / رخصة"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">الحالة</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          >
            <option value="">الكل</option>
            <option value="active">نشط</option>
            <option value="inactive">معطل</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-indigo-900/20 dark:bg-[#0b1220]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-[#0f172a] dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 text-right font-semibold">اسم المكتب</th>
              <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
              <th className="px-4 py-3 text-right font-semibold">الإيميل</th>
              <th className="px-4 py-3 text-right font-semibold">الرخصة</th>
              <th className="px-4 py-3 text-right font-semibold">عدد الملاك</th>
              <th className="px-4 py-3 text-right font-semibold">عدد العقارات</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-left font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  لا توجد مكاتب.
                </td>
              </tr>
            ) : (
              items.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{o.name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200" dir="ltr">{o.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{o.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{o.license ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{o.owners_count}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{o.properties_count}</td>
                  <td className="px-4 py-3">
                    <span className={cls("rounded-full px-2 py-0.5 text-xs font-bold", o.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300")}>
                      {o.is_active ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => toggle.mutate(o)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-950/30 dark:text-indigo-200"
                    >
                      {o.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600 dark:text-gray-300">
          صفحة {data.page} من {data.totalPages} • الإجمالي {data.total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:border-indigo-900/30 dark:bg-[#0b1220] dark:text-gray-200"
          >
            السابق
          </button>
          <button
            type="button"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:border-indigo-900/30 dark:bg-[#0b1220] dark:text-gray-200"
          >
            التالي
          </button>
        </div>
      </div>
    </div>
  );
}

