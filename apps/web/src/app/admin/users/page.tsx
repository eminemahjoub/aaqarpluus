"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: "owner" | "agency" | "superadmin";
  is_active: boolean;
  created_at: string | null;
  stats: { properties: number; units: number; contracts: number };
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number; search?: string };

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState<"" | "owner" | "agency" | "superadmin">("");
  const [status, setStatus] = React.useState<"" | "active" | "inactive">("");
  const [page, setPage] = React.useState(1);

  const q = useQuery({
    queryKey: ["admin", "users", { search, role, status, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", "25");
      if (search.trim()) sp.set("search", search.trim());
      if (role) sp.set("role", role);
      if (status) sp.set("status", status);
      const res = await authFetch(`/api/admin/users?${sp.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل المستخدمين");
      }
      return (await res.json()) as Paged<UserRow>;
    },
    placeholderData: (prev) => prev,
  });

  const toggleActive = useMutation({
    mutationFn: async (u: UserRow) => {
      const res = await authFetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر التحديث");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (u: UserRow) => {
      const res = await authFetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_password: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر إعادة التعيين");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.newPassword) {
        window.prompt("كلمة المرور الجديدة (تظهر مرة واحدة فقط):", String(data.newPassword));
      }
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (u: UserRow) => {
      const okDel = window.confirm("هل تريد حذف المستخدم (soft delete)؟");
      if (!okDel) return;
      const res = await authFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر الحذف");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
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
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">المستخدمين</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">بحث، فلترة، تفعيل/تعطيل، إعادة تعيين كلمة السر، حذف (soft delete).</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220] md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">بحث</label>
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="اسم / إيميل / جوال"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">الدور</label>
          <select
            value={role}
            onChange={(e) => { setPage(1); setRole(e.target.value as any); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          >
            <option value="">الكل</option>
            <option value="owner">owner</option>
            <option value="agency">agency</option>
            <option value="superadmin">superadmin</option>
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
            <option value="active">نشط</option>
            <option value="inactive">معطل</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-indigo-900/20 dark:bg-[#0b1220]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-[#0f172a] dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 text-right font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right font-semibold">الإيميل</th>
              <th className="px-4 py-3 text-right font-semibold">الجوال</th>
              <th className="px-4 py-3 text-right font-semibold">الدور</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">إحصائيات</th>
              <th className="px-4 py-3 text-left font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  لا يوجد مستخدمون.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{u.email}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200" dir="ltr">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={cls("rounded-full px-2 py-0.5 text-xs font-bold", u.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300")}>
                      {u.is_active ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                    عقارات: {u.stats.properties} • وحدات: {u.stats.units} • عقود: {u.stats.contracts}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive.mutate(u)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-950/30 dark:text-indigo-200"
                      >
                        {u.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword.mutate(u)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        Reset Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser.mutate(u)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-200"
                      >
                        حذف
                      </button>
                    </div>
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

