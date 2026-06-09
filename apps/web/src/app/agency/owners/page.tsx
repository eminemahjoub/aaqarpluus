"use client";

import * as React from "react";
import { MessageSquare, CheckCircle2, X } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onSyncEvent, broadcastSync } from "@/lib/sync-engine";
import CreateOwnerForm, { type CreatedOwner } from "@/components/agency/CreateOwnerForm";

export default function AgencyOwnersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [syncTick, setSyncTick] = React.useState(0);

  const ownersQuery = useQuery({
    queryKey: ["agency", "owners", syncTick],
    queryFn: async () => {
      const res = await authFetch("/api/offices/owners");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `فشل تحميل الملاك: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as CreatedOwner[]) : [];
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  // Cross-tab sync
  React.useEffect(() => {
    const unsub = onSyncEvent((payload) => {
      if (payload.event === "owners:mutated" || payload.event === "contacts:mutated" || payload.event === "any:mutated") {
        setSyncTick((t) => t + 1);
      }
    });
    return () => { unsub(); };
  }, []);

  React.useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  async function handleLinkOwner() {
    setLinkError(null);
    setFormError(null);
    const res = await authFetch("/api/offices/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerEmail }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setLinkError(j?.error ?? "تعذر الربط");
      return;
    }
    setOwnerEmail("");
    await qc.invalidateQueries({ queryKey: ["agency", "owners"] });
    broadcastSync("owners:mutated");
  }

  async function handleDelete(linkId: string | null, ownerId: string) {
    if (linkId) {
      await authFetch(`/api/offices/owners/${linkId}`, { method: "DELETE" });
    } else {
      // Agency-created owner without office link: clear created_by_agency_id
      await authFetch(`/api/offices/owners/unlink/${ownerId}`, { method: "DELETE" });
    }
    await qc.invalidateQueries({ queryKey: ["agency", "owners"] });
    broadcastSync("owners:mutated");
  }

  async function handleMessage(ownerId: string) {
    const res = await authFetch("/api/messages/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "direct", participant_ids: [ownerId] }),
    });
    const j = await res.json().catch(() => ({}));
    const convId = String(j?.id ?? "");
    if (convId) router.push(`/agency/messages?c=${encodeURIComponent(convId)}`);
  }

  const rows = ownersQuery.data ?? [];
  const loading = ownersQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الملاك</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">إنشاء حسابات ملاك جديدة أو ربط حسابات موجودة</p>
      </div>

      {successMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-md p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">إنشاء حساب مالك جديد</h2>
        <CreateOwnerForm
          onSuccess={async (row) => {
            setFormError(null);
            setSuccessMessage(`تم إنشاء حساب المالك "${row.full_name ?? row.email}" وربطه بالمكتب.`);
            await qc.invalidateQueries({ queryKey: ["agency", "owners"] });
            broadcastSync("owners:mutated");
            broadcastSync("contacts:mutated");
          }}
          onError={(msg) => setFormError(msg)}
        />
        {formError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">ربط حساب مالك موجود</h2>
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
            onClick={() => void handleLinkOwner()}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            ربط
          </button>
        </div>
        {linkError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{linkError}</p> : null}
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="border-b border-gray-100 p-4 dark:border-emerald-800/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">الملاك المرتبطون</h2>
        </div>
        {ownersQuery.isError ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">
            {(ownersQuery.error as Error)?.message ?? "خطأ في تحميل الملاك"}
            <button
              type="button"
              onClick={() => ownersQuery.refetch()}
              className="mr-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : loading ? (
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
                  <tr key={r.link_id ?? r.owner_id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300" dir="ltr">
                      {r.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleMessage(r.owner_id)}
                        className="ml-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-900/20"
                        title="مراسلة المالك"
                      >
                        <MessageSquare className="h-4 w-4" />
                        رسالة
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(r.link_id ?? null, r.owner_id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                      >
                        {r.link_id ? "فك الربط" : "حذف"}
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

