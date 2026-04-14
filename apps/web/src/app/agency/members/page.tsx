"use client";

import * as React from "react";
import { authFetch } from "@/lib/auth-fetch";

export default function AgencyMembersPage() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Array<{ id: string; email: string; full_name: string | null; phone: string | null; created_at: string | null }>>([]);
  const [form, setForm] = React.useState({ email: "", password: "", fullName: "", phone: "" });
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await authFetch("/api/offices/members");
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الموظفين</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">إنشاء حسابات لموظفي المكتب (user_type=agency)</p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الإيميل</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="member@office.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">كلمة المرور</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="******"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الاسم</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="اسم الموظف"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الجوال</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="5xxxxxxxx"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              void (async () => {
                const res = await authFetch("/api/offices/members", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => null);
                  setError(j?.error ?? "تعذر الإنشاء");
                  return;
                }
                setForm({ email: "", password: "", fullName: "", phone: "" });
                await refresh();
              })();
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            إضافة موظف
          </button>
          {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="border-b border-gray-100 p-4 dark:border-emerald-800/30">
          <h2 className="font-semibold text-gray-900 dark:text-white">قائمة الموظفين</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">لا يوجد موظفون.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">الاسم</th>
                  <th className="px-4 py-3 text-right font-medium">الإيميل</th>
                  <th className="px-4 py-3 text-right font-medium">الجوال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300" dir="ltr">
                      {r.phone ?? "—"}
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

