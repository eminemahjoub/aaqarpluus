"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

type Row = {
  id: string;
  created_at: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  changes: any;
  metadata: any;
};
type Paged<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number; search?: string };

export default function AdminAuditLogsPage() {
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "auditLogs", { search, action, entityType, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", "50");
      if (search.trim()) sp.set("search", search.trim());
      if (action) sp.set("action", action);
      if (entityType) sp.set("entity_type", entityType);
      const res = await authFetch(`/api/admin/audit-logs?${sp.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل السجل");
      }
      return (await res.json()) as Paged<Row>;
    },
    placeholderData: (prev) => prev,
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const data = q.data!;
  const items = data.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">سجل النشاط</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Read-only مع filters + pagination.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220] md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">بحث</label>
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="إيميل / action / entity"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">العملية</label>
          <input
            value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }}
            placeholder="login/update/delete..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">النوع</label>
          <input
            value={entityType}
            onChange={(e) => { setPage(1); setEntityType(e.target.value); }}
            placeholder="user/office/..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-indigo-900/20 dark:bg-[#0b1220]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-[#0f172a] dark:text-gray-300">
            <tr>
              <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
              <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
              <th className="px-4 py-3 text-right font-semibold">العملية</th>
              <th className="px-4 py-3 text-right font-semibold">النوع</th>
              <th className="px-4 py-3 text-right font-semibold">IP</th>
              <th className="px-4 py-3 text-left font-semibold">تفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-indigo-900/20">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  لا توجد عمليات.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#0f172a]">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.created_at ? String(r.created_at).replace("T", " ").slice(0, 16) : "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.user_email ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{r.action}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.entity_type ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200" dir="ltr">{r.ip_address ?? "—"}</td>
                    <td className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === r.id ? null : r.id)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-950/30 dark:text-indigo-200"
                      >
                        {openId === r.id ? "إخفاء" : "عرض"}
                      </button>
                    </td>
                  </tr>
                  {openId === r.id ? (
                    <tr className="bg-gray-50 dark:bg-[#0f172a]">
                      <td colSpan={6} className="px-4 py-3">
                        <pre className="overflow-auto rounded-xl bg-white p-3 text-xs text-gray-800 dark:bg-[#0b1220] dark:text-gray-100">
                          {JSON.stringify({ entity_id: r.entity_id, changes: r.changes, metadata: r.metadata }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
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

