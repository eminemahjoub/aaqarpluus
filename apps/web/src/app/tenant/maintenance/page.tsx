"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TenantMaintenancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadRequests() {
    try {
      const res = await fetch("/api/tenant/maintenance", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/tenant/login");
          return;
        }
        throw new Error("فشل تحميل الطلبات");
      }
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  useEffect(() => {
    void (async () => {
      await loadRequests();
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/tenant/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "فشل إرسال الطلب");
        return;
      }
      setSuccess("تم إرسال طلب الصيانة بنجاح");
      setTitle("");
      setDescription("");
      setPriority("medium");
      await loadRequests();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSubmitting(false);
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
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">طلبات الصيانة</h1>
          <Link
            href="/tenant/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            لوحة التحكم
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">طلب صيانة جديد</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">عنوان المشكلة</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تسرب مياه في الحمام"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الوصف</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل..."
                className="h-28 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
              </select>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-green-600">{success}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">الطلبات السابقة</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد طلبات صيانة سابقة</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-gray-100 p-4 dark:border-emerald-800/30"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white">{req.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        req.status === "done"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : req.status === "in_progress"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {statusLabel(req.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{req.description}</p>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    الأولوية: {req.priority === "high" ? "عالية" : req.priority === "low" ? "منخفضة" : "متوسطة"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
