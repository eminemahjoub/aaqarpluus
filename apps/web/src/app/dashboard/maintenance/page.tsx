"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MaintenanceManagementPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests() {
    try {
      const res = await fetch("/api/tasks?type=maintenance", { credentials: "include" });
      if (!res.ok) throw new Error("فشل تحميل طلبات الصيانة");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("فشل تحديث الحالة");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  async function updatePriority(id: string, priority: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("فشل تحديث الأولوية");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      pending: "معلّق",
      in_progress: "قيد التنفيذ",
      done: "مكتمل",
      cancelled: "ملغى",
    };
    return map[status] ?? status;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-[#0f1e14]">
        <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-[#0f1e14]" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة طلبات الصيانة</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            لوحة التحكم
          </Link>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">الطلب</th>
                  <th className="px-4 py-3 text-right font-medium">العقار</th>
                  <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                  <th className="px-4 py-3 text-right font-medium">المستأجر</th>
                  <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      لا توجد طلبات صيانة
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{req.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{req.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{req.property?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{req.unit?.label ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{req.tenant?.name ?? req.contact?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={req.priority}
                          onChange={(e) => updatePriority(req.id, e.target.value)}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        >
                          <option value="low">منخفضة</option>
                          <option value="medium">متوسطة</option>
                          <option value="high">عالية</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={req.status}
                          onChange={(e) => updateStatus(req.id, e.target.value)}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        >
                          <option value="pending">معلّق</option>
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="done">مكتمل</option>
                          <option value="cancelled">ملغى</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {req.created_at ? String(req.created_at).split("T")[0] : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
