"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useRouter } from "next/navigation";

export default function AgencyOwnersPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Array<{ link_id: string; owner_id: string; full_name: string | null; email: string; phone: string | null }>>([]);
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await authFetch("/api/offices/owners");
      const data = res.ok ? await res.json() : [];
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الملاك</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">اربط ملاك (حسابات owner) بالمكتب عبر الإيميل</p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">إيميل المالك</label>
            <input
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void (async () => {
                const res = await authFetch("/api/offices/owners", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ownerEmail }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => null);
                  setError(j?.error ?? "تعذر الربط");
                  return;
                }
                setOwnerEmail("");
                await refresh();
              })();
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            ربط
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="border-b border-gray-100 p-4 dark:border-emerald-800/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">الملاك المرتبطون</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">لا يوجد ملاك مرتبطون بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">الاسم</th>
                  <th className="px-4 py-3 text-right font-medium">الإيميل</th>
                  <th className="px-4 py-3 text-right font-medium">الجوال</th>
                  <th className="px-4 py-3 text-right font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {rows.map((r) => (
                  <tr key={r.link_id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300" dir="ltr">
                      {r.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            const res = await authFetch("/api/messages/conversations", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "direct", participant_ids: [String(r.owner_id)] }),
                            });
                            const j = await res.json().catch(() => ({}));
                            const convId = String(j?.id ?? "");
                            if (convId) router.push(`/agency/messages?c=${encodeURIComponent(convId)}`);
                          })();
                        }}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-900/20"
                        title="مراسلة المالك"
                      >
                        <MessageSquare className="h-4 w-4" />
                        رسالة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            await authFetch(`/api/offices/owners/${r.link_id}`, { method: "DELETE" });
                            await refresh();
                          })();
                        }}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                      >
                        فك الربط
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

