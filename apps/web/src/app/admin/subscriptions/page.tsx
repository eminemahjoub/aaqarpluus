"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

type SubRow = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  plan: "free" | "basic" | "premium" | "enterprise";
  status: "active" | "expired" | "cancelled" | "trial";
  start_date: string;
  end_date: string | null;
  price: number;
  max_properties: number;
  max_units: number;
  max_users: number;
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number; search?: string; stats?: any };

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"" | SubRow["status"]>("");
  const [plan, setPlan] = React.useState<"" | SubRow["plan"]>("");
  const [page, setPage] = React.useState(1);

  const q = useQuery({
    queryKey: ["admin", "subscriptions", { search, status, plan, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", "25");
      if (search.trim()) sp.set("search", search.trim());
      if (status) sp.set("status", status);
      if (plan) sp.set("plan", plan);
      const res = await authFetch(`/api/admin/subscriptions?${sp.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل الاشتراكات");
      }
      return (await res.json()) as Paged<SubRow>;
    },
    placeholderData: (prev) => prev,
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: any }) => {
      const res = await authFetch(`/api/admin/subscriptions/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر التحديث");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm("إلغاء الاشتراك؟")) return;
      const res = await authFetch(`/api/admin/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر الإلغاء");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const data = q.data!;
  const items = data.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">الاشتراكات</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            إدارة الباقات والحالة. (الـ create manual نزيدوه في خطوة ثانية)
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 dark:border-indigo-900/30 dark:bg-indigo-950/30 dark:text-indigo-200">
          دخل الاشتراكات (active+trial): {Number((data as any)?.stats?.revenue_active ?? 0) || 0} SAR
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220] md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">بحث</label>
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="إيميل / اسم / جوال"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">الخطة</label>
          <select
            value={plan}
            onChange={(e) => { setPage(1); setPlan(e.target.value as any); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          >
            <option value="">الكل</option>
            <option value="free">free</option>
            <option value="basic">basic</option>
            <option value="premium">premium</option>
            <option value="enterprise">enterprise</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">الحالة</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          >
            <option value="">الكل</option>
            <option value="active">active</option>
            <option value="trial">trial</option>
            <option value="expired">expired</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-indigo-900/20 dark:bg-[#0b1220]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-[#0f172a] dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
              <th className="px-4 py-3 text-right font-semibold">الخطة</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">تاريخ البدء</th>
              <th className="px-4 py-3 text-right font-semibold">تاريخ الانتهاء</th>
              <th className="px-4 py-3 text-right font-semibold">السعر</th>
              <th className="px-4 py-3 text-left font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  لا توجد اشتراكات.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    <div className="font-semibold">{s.user_name ?? "—"}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">{s.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={s.plan}
                      onChange={(e) => update.mutate({ id: s.id, patch: { plan: e.target.value } })}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-indigo-900/30 dark:bg-[#0b1220] dark:text-gray-200"
                    >
                      <option value="free">free</option>
                      <option value="basic">basic</option>
                      <option value="premium">premium</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={s.status}
                      onChange={(e) => update.mutate({ id: s.id, patch: { status: e.target.value } })}
                      className={cls(
                        "rounded-lg border px-2 py-1 text-xs",
                        "border-gray-200 bg-white dark:border-indigo-900/30 dark:bg-[#0b1220] dark:text-gray-200"
                      )}
                    >
                      <option value="active">active</option>
                      <option value="trial">trial</option>
                      <option value="expired">expired</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{s.start_date}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{s.end_date ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{Number(s.price) || 0}</td>
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => cancel.mutate(s.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-200"
                    >
                      إلغاء
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

