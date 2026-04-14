"use client";

import * as React from "react";
import { Loader2, Phone, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { authFetch } from "@/lib/auth-fetch";

type OfficeGroup = {
  officeId: string;
  officeName: string;
  propertiesCount?: number;
  officeContactName?: string | null;
  officeEmail?: string | null;
  officePhone?: string | null;
};

type PropertyOption = { id: string; name: string };

function normalizeSaudiPhoneInput(raw: string) {
  return String(raw ?? "").trim().replace(/\s+/g, "");
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function OwnerAgenciesPage() {
  const [loading, setLoading] = React.useState(true);
  const [groups, setGroups] = React.useState<OfficeGroup[]>([]);

  const [activeOfficeId, setActiveOfficeId] = React.useState<string>("");
  const [agencyPhone, setAgencyPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const gRes = await authFetch("/api/owner/agencies");
      const g = gRes.ok ? await gRes.json() : [];
      const nextGroups: OfficeGroup[] = Array.isArray(g) ? g : [];
      setGroups(nextGroups);
      if (!activeOfficeId && nextGroups.length > 0) setActiveOfficeId(String(nextGroups[0].officeId));
    } catch {
      setError("تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLink() {
    setError(null);
    const phone = normalizeSaudiPhoneInput(agencyPhone);

    if (!phone) return setError("أدخل رقم جوال المكتب");

    setSubmitting(true);
    try {
      const res = await authFetch("/api/owner/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyPhone: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(String(data?.error ?? "تعذّر ربط المكتب"));

      setAgencyPhone("");
      await loadAll();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink(officeId: string, propertyId?: string) {
    setError(null);
    try {
      const url = new URL("/api/owner/agencies", window.location.origin);
      url.searchParams.set("office_id", officeId);
      if (propertyId) url.searchParams.set("property_id", propertyId);
      const res = await authFetch(url.toString(), { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(String(data?.error ?? "تعذّر فك الربط"));
      await loadAll();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    }
  }

  return (
    <DashboardLayout role="owner">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المكاتب</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">أضف مكتباً برقم الجوال، وشاهد قائمة المكاتب المضافة.</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Main */}
          <section className="min-w-0 flex-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">إضافة مكتب</h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">أدخل رقم جوال حساب المكتب (agency) لإضافته لقائمتك.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">رقم جوال المكتب</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 dark:border-emerald-800/50 dark:bg-[#102318]">
                    <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <input
                      value={agencyPhone}
                      onChange={(e) => setAgencyPhone(e.target.value)}
                      placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                      className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                      disabled={submitting}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleLink}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? "جارٍ الإضافة…" : "إضافة المكتب"}
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">المكاتب المضافة</h3>
                  <button
                    type="button"
                    onClick={loadAll}
                    disabled={loading}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-[#102318] dark:text-gray-200 dark:hover:bg-[#1a3528]"
                  >
                    تحديث
                  </button>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-emerald-800/30 dark:bg-[#102318]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700 dark:bg-[#132a1f] dark:text-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-right font-semibold">المكتب</th>
                        <th className="px-4 py-3 text-right font-semibold">الجوال</th>
                        <th className="px-4 py-3 text-right font-semibold">البريد</th>
                        <th className="px-4 py-3 text-right font-semibold">عدد العقارات</th>
                        <th className="px-4 py-3 text-left font-semibold">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-emerald-800/30">
                      {groups.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-center text-gray-500 dark:text-gray-400" colSpan={5}>
                            لا توجد مكاتب مضافة بعد.
                          </td>
                        </tr>
                      ) : (
                        groups.map((g) => {
                          const active = String(activeOfficeId) === String(g.officeId);
                          return (
                            <tr
                              key={g.officeId}
                              className={active ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}
                              onClick={() => setActiveOfficeId(String(g.officeId))}
                            >
                              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{g.officeName}</td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-200" dir="ltr">
                                {g.officePhone ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-200" dir="ltr">
                                {g.officeEmail ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                                {Number(g.propertiesCount ?? 0)}
                              </td>
                              <td className="px-4 py-3 text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleUnlink(String(g.officeId));
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

