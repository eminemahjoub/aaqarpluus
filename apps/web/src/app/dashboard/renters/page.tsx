"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Home, MapPin, Phone, User, Wallet, X, FileText, Key, Search } from "lucide-react";

type Renter = {
  id: string;
  name: string;
  phone?: string;
  alternative_phone?: string;
  sex?: string;
  id_number?: string;
  status?: string;
  pin_hash?: string;
};

type Contract = {
  id: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  rent_total_sar?: number;
  rent_amount_sar?: number;
  payment_frequency?: string;
  installments_count?: number;
  property?: { id?: string; name?: string };
  unit?: { id?: string; label?: string };
};

function formatCurrency(n?: number) {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toLocaleString()} ر.س`;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA");
}

function statusLabel(status?: string) {
  if (status === "active") return { text: "نشط", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  return { text: status ?? "—", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400" };
}

export default function RentersCardsPage() {
  const [selected, setSelected] = React.useState<Renter | null>(null);
  const [search, setSearch] = React.useState("");

  const rentersQuery = useQuery({
    queryKey: ["renters"],
    queryFn: async () => {
      const res = await authFetch("/api/contacts?type=tenant");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل المستأجرين");
      }
      return (await res.json()) as Renter[];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["renter-contracts", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const res = await authFetch(`/api/contracts?contact_id=${selected.id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل العقود");
      }
      return (await res.json()) as Contract[];
    },
    enabled: Boolean(selected),
  });

  const renters = rentersQuery.data ?? [];
  const filtered = search.trim()
    ? renters.filter((r) =>
        [r.name, r.phone, r.alternative_phone, r.id_number].some((v) => (v ?? "").toLowerCase().includes(search.toLowerCase()))
      )
    : renters;

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المستأجرين</h1>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الجوال أو رقم الهوية"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pr-9 pl-4 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white sm:w-72"
            />
          </div>
        </div>

        {rentersQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-[#1a3528]" />
            ))}
          </div>
        ) : rentersQuery.isError ? (
          <p className="text-red-600">{(rentersQuery.error as any)?.message ?? "حدث خطأ"}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center dark:bg-[#132a1f]">
            <p className="text-gray-500 dark:text-gray-400">لا يوجد مستأجرين</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((renter) => (
              <button
                key={renter.id}
                onClick={() => setSelected(renter)}
                className="rounded-xl bg-white p-5 text-right shadow-sm transition hover:shadow-md dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">مستأجر</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <User className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{renter.name}</h3>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{renter.phone ?? "—"}</span>
                  </div>
                  {renter.id_number ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-mono">{renter.id_number}</span>
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-[#132a1f]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">تفاصيل المستأجر</h2>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#1a3528]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.name}</h3>
                </div>
                <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span dir="ltr">{selected.phone ?? "—"}</span>
                  </div>
                  {selected.alternative_phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span dir="ltr">{selected.alternative_phone}</span>
                    </div>
                  ) : null}
                  {selected.id_number ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{selected.id_number}</span>
                    </div>
                  ) : null}
                  {selected.sex ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">الجنس:</span>
                      <span>{selected.sex}</span>
                    </div>
                  ) : null}
                  {selected.pin_hash ? (
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-400" />
                      <span className="text-emerald-700 dark:text-emerald-400">يمكنه تسجيل الدخول</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">عقود الإيجار</h3>
                {contractsQuery.isLoading ? (
                  <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-[#1a3528]" />
                ) : contractsQuery.isError ? (
                  <p className="text-red-600">{(contractsQuery.error as any)?.message ?? "حدث خطأ"}</p>
                ) : (contractsQuery.data ?? []).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">لا توجد عقود لهذا المستأجر</p>
                ) : (
                  <div className="space-y-3">
                    {(contractsQuery.data ?? []).map((contract) => {
                      const s = statusLabel(contract.status);
                      return (
                        <div key={contract.id} className="rounded-lg border border-gray-100 p-4 dark:border-emerald-800/30">
                          <div className="mb-3 flex items-center justify-between">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.text}</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Home className="h-4 w-4 text-gray-400" />
                              <span>{contract.property?.name ?? "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>{contract.unit?.label ?? "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>{formatDate(contract.start_date)} – {formatDate(contract.end_date)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <Wallet className="h-4 w-4 text-gray-400" />
                              <span>{formatCurrency(contract.rent_total_sar)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
