"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";

type SettingRow = { key: string; value: any; updated_by: string | null; updated_at: string | null };

function Section({
  title,
  children,
  onSave,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-indigo-900/20 dark:bg-[#0b1220]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h2>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
        >
          {saving ? "..." : "حفظ"}
        </button>
      </div>
      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/settings");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل الإعدادات");
      }
      return (await res.json()) as SettingRow[];
    },
  });

  const map = React.useMemo(() => {
    const m = new Map<string, SettingRow>();
    for (const r of q.data ?? []) m.set(String(r.key), r);
    return m;
  }, [q.data]);

  const getVal = (key: string, fallback: any) => (map.get(key)?.value ?? fallback);

  const [platformName, setPlatformName] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [freeProps, setFreeProps] = React.useState(5);
  const [freeUnits, setFreeUnits] = React.useState(20);
  const [freeUsers, setFreeUsers] = React.useState(1);
  const [defaultCommission, setDefaultCommission] = React.useState(0);
  const [emailEnabled, setEmailEnabled] = React.useState(false);

  React.useEffect(() => {
    if (!q.data) return;
    setPlatformName(String(getVal("platform_name", "AaqarPlus")));
    setLogoUrl(String(getVal("logo_url", "")));
    setDescription(String(getVal("platform_description", "")));
    setFreeProps(Number(getVal("free_plan.max_properties", 5)) || 5);
    setFreeUnits(Number(getVal("free_plan.max_units", 20)) || 20);
    setFreeUsers(Number(getVal("free_plan.max_users", 1)) || 1);
    setDefaultCommission(Number(getVal("default_commission_percent", 0)) || 0);
    setEmailEnabled(Boolean(getVal("email_notifications_enabled", false)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const put = useMutation({
    mutationFn: async (args: { key: string; value: any }) => {
      const res = await authFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر الحفظ");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  if (q.isLoading) return <PageLoading rows={6} />;
  if (q.isError) return <ErrorState message={(q.error as any)?.message ?? "خطأ"} onRetry={() => q.refetch()} />;

  const last = (key: string) => {
    const r = map.get(key);
    if (!r?.updated_at) return null;
    return `آخر تحديث: ${String(r.updated_at).replace("T", " ").slice(0, 16)} بواسطة ${r.updated_by ?? "—"}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">الإعدادات</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Platform settings (key/value).</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="عام"
          saving={put.isPending}
          onSave={() => {
            void (async () => {
              await put.mutateAsync({ key: "platform_name", value: platformName });
              await put.mutateAsync({ key: "logo_url", value: logoUrl });
              await put.mutateAsync({ key: "platform_description", value: description });
            })();
          }}
        >
          <div className="grid gap-3">
            <input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="اسم المنصة" />
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="رابط اللوقو" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="وصف" rows={3} />
            <div className="text-xs text-gray-500 dark:text-gray-400">{last("platform_name") ?? ""}</div>
          </div>
        </Section>

        <Section
          title="الباقات (Free limits)"
          saving={put.isPending}
          onSave={() => {
            void (async () => {
              await put.mutateAsync({ key: "free_plan.max_properties", value: freeProps });
              await put.mutateAsync({ key: "free_plan.max_units", value: freeUnits });
              await put.mutateAsync({ key: "free_plan.max_users", value: freeUsers });
            })();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <input type="number" value={freeProps} onChange={(e) => setFreeProps(Number(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="عقارات" />
            <input type="number" value={freeUnits} onChange={(e) => setFreeUnits(Number(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="وحدات" />
            <input type="number" value={freeUsers} onChange={(e) => setFreeUsers(Number(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white" placeholder="مستخدمين" />
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{last("free_plan.max_properties") ?? ""}</div>
        </Section>

        <Section
          title="العمولات"
          saving={put.isPending}
          onSave={() => {
            void put.mutateAsync({ key: "default_commission_percent", value: defaultCommission });
          }}
        >
          <input
            type="number"
            value={defaultCommission}
            onChange={(e) => setDefaultCommission(Number(e.target.value) || 0)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-white"
            placeholder="نسبة العمولة الافتراضية"
          />
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{last("default_commission_percent") ?? ""}</div>
        </Section>

        <Section
          title="الإشعارات"
          saving={put.isPending}
          onSave={() => {
            void put.mutateAsync({ key: "email_notifications_enabled", value: emailEnabled });
          }}
        >
          <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-indigo-900/30 dark:bg-[#0f172a] dark:text-gray-200">
            <span className="font-semibold">تفعيل إشعارات الإيميل</span>
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          </label>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{last("email_notifications_enabled") ?? ""}</div>
        </Section>
      </div>
    </div>
  );
}

