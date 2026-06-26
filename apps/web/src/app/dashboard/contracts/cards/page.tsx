"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Home, Phone, User, X, MapPin, Wallet, Clock, FileText } from "lucide-react";

type Contract = {
  id: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  rent_total_sar?: number;
  rent_amount_sar?: number;
  payment_frequency?: string;
  installments_count?: number;
  notes?: string;
  contact?: {
    id?: string;
    name?: string;
    phone?: string;
    id_number?: string;
    sex?: string;
  };
  property?: {
    id?: string;
    name?: string;
  };
  unit?: {
    id?: string;
    label?: string;
  };
};

function statusLabel(status?: string) {
  if (status === "active") return { text: "نشط", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (status === "inactive") return { text: "غير نشط", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400" };
  return { text: status ?? "—", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400" };
}

function formatCurrency(n?: number) {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toLocaleString()} ر.س`;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA");
}

export default function ContractsCardsPage() {
  const [selected, setSelected] = React.useState<Contract | null>(null);

  const contractsQuery = useQuery({
    queryKey: ["contracts", "cards"],
    queryFn: async () => {
      const res = await authFetch("/api/contracts");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل العقود");
      }
      return (await res.json()) as Contract[];
    },
  });

  const contracts = contractsQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">عقود الإيجار</h1>
        </div>

        {contractsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-[#1a3528]" />
            ))}
          </div>
        ) : contractsQuery.isError ? (
          <p className="text-red-600">{(contractsQuery.error as any)?.message ?? "حدث خطأ"}</p>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center dark:bg-[#132a1f]">
            <p className="text-gray-500 dark:text-gray-400">لا توجد عقود</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contracts.map((contract) => {
              const status = statusLabel(contract.status);
              return (
                <button
                  key={contract.id}
                  onClick={() => setSelected(contract)}
                  className="rounded-xl bg-white p-5 text-right shadow-sm transition hover:shadow-md dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.text}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <User className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{contract.contact?.name ?? "—"}</h3>
                  <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span dir="ltr">{contract.contact?.phone ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      <span>{contract.property?.name ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(contract.start_date)} – {formatDate(contract.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <span>{formatCurrency(contract.rent_total_sar)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.contact?.name ?? "—"}</h3>
                </div>
                <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span dir="ltr">{selected.contact?.phone ?? "—"}</span>
                  </div>
                  {selected.contact?.id_number ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-mono">{selected.contact.id_number}</span>
                    </div>
                  ) : null}
                  {selected.contact?.sex ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">الجنس:</span>
                      <span>{selected.contact.sex}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">العقد</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">العقار</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Home className="h-4 w-4 text-gray-400" />
                      {selected.property?.name ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">الوحدة</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {selected.unit?.label ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">بداية العقد</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(selected.start_date)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">نهاية العقد</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {formatDate(selected.end_date)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">إجمالي الإيجار</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Wallet className="h-4 w-4 text-gray-400" />
                      {formatCurrency(selected.rent_total_sar)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">قيمة القسط</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Wallet className="h-4 w-4 text-gray-400" />
                      {formatCurrency(selected.rent_amount_sar)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">طريقة الدفع</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {selected.payment_frequency ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">عدد الأقساط</span>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {selected.installments_count ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              {selected.notes ? (
                <div className="rounded-lg border border-gray-100 p-3 dark:border-emerald-800/30">
                  <span className="block text-xs text-gray-500 dark:text-gray-400">ملاحظات</span>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selected.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
