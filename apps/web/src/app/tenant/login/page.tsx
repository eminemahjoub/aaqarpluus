"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TenantLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "فشل تسجيل الدخول");
        return;
      }
      router.push("/tenant/dashboard");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-[#0f1e14]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">بوابة المستأجر</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">رقم الجوال</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">رمز الدخول</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
