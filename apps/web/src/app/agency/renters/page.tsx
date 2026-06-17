"use client";

import * as React from "react";
import {
  Phone, User, Search, Filter, MessageSquare, FileText, Calendar, Mail, Shield, IdCard,
  Plus, X, Building2, DoorOpen, Coins, Repeat, ClipboardList
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { onSyncEvent, broadcastSync } from "@/lib/sync-engine";

type Renter = {
  id: string;
  name: string;
  phone: string | null;
  alternative_phone: string | null;
  sex: string | null;
  id_number: string | null;
  email: string | null;
  type: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type PropertyItem = { id: string; name: string };

type UnitItem = { id: string; label: string; property_id: string };

type ContractExtra = {
  contract_number?: string | null;
  [key: string]: unknown;
};

type ContractItem = {
  id: string;
  contact_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  start_date: string | null;
  end_date: string | null;
  rent_total_sar: number | string | null;
  payment_frequency: string | null;
  installments_count: number | null;
  status: string;
  notes: string | null;
  extra: ContractExtra | string | null;
  created_at: string;
};

type PaymentItem = {
  id: string;
  contract_id: string;
  amount_sar: number | string;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

function toArabicFrequency(f: string | null) {
  switch (f) {
    case "monthly": return "شهري";
    case "quarterly": return "ربع سنوي";
    case "half-yearly": return "نصف سنوي";
    case "yearly": return "سنوي";
    case "weekly": return "أسبوعي";
    case "one-time": return "دفعة واحدة";
    default: return f ?? "—";
  }
}

function toArabicSex(s: string | null) {
  if (s === "male") return "ذكر";
  if (s === "female") return "أنثى";
  return "—";
}

function toArabicStatus(s: string | null) {
  if (s === "active") return "نشط";
  if (s === "inactive") return "غير نشط";
  return s ?? "—";
}

function toArabicPaymentStatus(s: string | null) {
  if (s === "paid") return "مدفوع";
  if (s === "pending") return "قيد الانتظار";
  return s ?? "—";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("ar-SA")} ر.س`;
}

function getContractNumber(contract: ContractItem | null) {
  const extra = contract?.extra;
  if (extra && typeof extra === "object" && "contract_number" in extra) {
    return String((extra as { contract_number?: unknown }).contract_number ?? "");
  }
  return "";
}

function getActiveContractForRenter(contracts: ContractItem[], renterId: string) {
  return [...contracts]
    .filter((contract) => contract.contact_id === renterId)
    .sort((a, b) => {
      const statusRank = (status: string) => (status === "active" ? 1 : 0);
      const rankDiff = statusRank(b.status) - statusRank(a.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.start_date ?? b.created_at).getTime() - new Date(a.start_date ?? a.created_at).getTime();
    })[0] ?? null;
}

function getNextPayment(payments: PaymentItem[]) {
  return [...payments]
    .filter((payment) => payment.status !== "paid")
    .sort((a, b) => {
      const aDate = a.due_date ?? a.created_at;
      const bDate = b.due_date ?? b.created_at;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0] ?? null;
}

export default function AgencyRentersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [syncTick, setSyncTick] = React.useState(0);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedRenter, setSelectedRenter] = React.useState<Renter | null>(null);
  const [paymentsModalContract, setPaymentsModalContract] = React.useState<ContractItem | null>(null);

  // Contract form state
  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [rentAmount, setRentAmount] = React.useState("");
  const [paymentFrequency, setPaymentFrequency] = React.useState("monthly");
  const [installmentsCount, setInstallmentsCount] = React.useState("");
  const [contractNumber, setContractNumber] = React.useState("");
  const [contractNotes, setContractNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const rentersQuery = useQuery({
    queryKey: ["agency", "renters", search, statusFilter, syncTick],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", "tenant");
      if (search.trim()) params.set("q", search.trim());
      const res = await authFetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `فشل تحميل المستأجرين: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as Renter[]) : [];
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  const contractsQuery = useQuery({
    queryKey: ["agency", "renters", "contracts", syncTick],
    queryFn: async () => {
      const res = await authFetch("/api/contracts");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `فشل تحميل العقود: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as ContractItem[]) : [];
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["agency", "renters", "contract-payments", syncTick],
    queryFn: async () => {
      const res = await authFetch("/api/contract-payments");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `فشل تحميل وصلات الدفع: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as PaymentItem[]) : [];
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  const propertiesQuery = useQuery({
    queryKey: ["agency", "properties", "minimal"],
    queryFn: async () => {
      const res = await authFetch("/api/properties?limit=500");
      if (!res.ok) throw new Error("فشل تحميل العقارات");
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.data ?? [];
      return (rows as PropertyItem[]).map((p) => ({ id: p.id, name: p.name }));
    },
    enabled: modalOpen,
    staleTime: 60000,
  });

  const unitsQuery = useQuery({
    queryKey: ["agency", "units", propertyId],
    queryFn: async () => {
      const res = await authFetch(`/api/units?property_id=${encodeURIComponent(propertyId)}`);
      if (!res.ok) throw new Error("فشل تحميل الوحدات");
      const data = await res.json();
      return (data as UnitItem[]).map((u) => ({ id: u.id, label: u.label, property_id: u.property_id }));
    },
    enabled: modalOpen && !!propertyId,
    staleTime: 30000,
  });

  const createContractMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await authFetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? "فشل إنشاء العقد");
      return j;
    },
    onSuccess: () => {
      setModalOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["agency", "renters"] });
      qc.invalidateQueries({ queryKey: ["agency", "renters", "contracts"] });
      qc.invalidateQueries({ queryKey: ["agency", "renters", "contract-payments"] });
      broadcastSync("contracts:mutated");
      broadcastSync("any:mutated");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Cross-tab sync: refresh when contacts/renters change anywhere
  React.useEffect(() => {
    const unsub = onSyncEvent((payload) => {
      if (payload.event === "contacts:mutated" || payload.event === "renters:mutated" || payload.event === "contracts:mutated" || payload.event === "any:mutated") {
        setSyncTick((t) => t + 1);
      }
    });
    return () => { unsub(); };
  }, []);

  const renters = React.useMemo(() => {
    let rows = rentersQuery.data ?? [];
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    return rows;
  }, [rentersQuery.data, statusFilter]);

  const paymentsByContract = React.useMemo(() => {
    const payments = paymentsQuery.data ?? [];
    const map = new Map<string, PaymentItem[]>();
    for (const payment of payments) {
      const existing = map.get(payment.contract_id) ?? [];
      existing.push(payment);
      map.set(payment.contract_id, existing);
    }
    for (const items of map.values()) {
      items.sort((a, b) => {
        const aDate = a.due_date ?? a.created_at;
        const bDate = b.due_date ?? b.created_at;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    }
    return map;
  }, [paymentsQuery.data]);

  const selectedPaymentContract = React.useMemo(() => {
    if (!paymentsModalContract) return null;
    return {
      contract: paymentsModalContract,
      payments: paymentsByContract.get(paymentsModalContract.id) ?? [],
    };
  }, [paymentsModalContract, paymentsByContract]);

  async function handleMessage(renterId: string) {
    const res = await authFetch("/api/messages/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "direct", participant_ids: [renterId] }),
    });
    const j = await res.json().catch(() => ({}));
    const convId = String(j?.id ?? "");
    if (convId) router.push(`/agency/messages?c=${encodeURIComponent(convId)}`);
  }

  function resetForm() {
    setPropertyId("");
    setUnitId("");
    setStartDate("");
    setEndDate("");
    setRentAmount("");
    setPaymentFrequency("monthly");
    setInstallmentsCount("");
    setContractNumber("");
    setContractNotes("");
    setFormError(null);
  }

  function openContractModal(renter: Renter) {
    setSelectedRenter(renter);
    resetForm();
    setModalOpen(true);
  }

  function handleSubmitContract(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedRenter) return;
    if (!propertyId) { setFormError("الرجاء اختيار العقار"); return; }
    if (!startDate) { setFormError("الرجاء إدخال تاريخ بدء العقد"); return; }
    if (!endDate) { setFormError("الرجاء إدخال تاريخ نهاية العقد (الأكبر / العقد)"); return; }
    if (new Date(endDate) <= new Date(startDate)) { setFormError("تاريخ نهاية العقد يجب أن يكون بعد تاريخ البدء"); return; }
    if (!rentAmount || Number(rentAmount) <= 0) { setFormError("الرجاء إدخال مبلغ الإيجار"); return; }
    if (!contractNumber.trim()) { setFormError("الرجاء إدخال رقم عقد الإيجار"); return; }

    createContractMutation.mutate({
      contact_id: selectedRenter.id,
      property_id: propertyId,
      unit_id: unitId || null,
      start_date: startDate,
      end_date: endDate,
      rent_total_sar: Number(rentAmount),
      payment_frequency: paymentFrequency,
      installments_count: installmentsCount ? Number(installmentsCount) : null,
      notes: contractNotes || null,
      extra: { contract_number: contractNumber.trim() },
      status: "active",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المستأجرين</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">قائمة بجميع المستأجرين المرتبطين بالمكتب</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الجوال..."
            className="w-full rounded-lg border border-gray-300 bg-white pr-9 pl-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {rentersQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-[#132a1f]" />
          ))}
        </div>
      ) : rentersQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {(rentersQuery.error as Error)?.message ?? "خطأ في التحميل"}
          <button
            type="button"
            onClick={() => rentersQuery.refetch()}
            className="mr-3 rounded-md border border-red-200 bg-red-100 px-2 py-1 text-xs font-semibold hover:bg-red-200 dark:border-red-900/40 dark:bg-red-900/20 dark:hover:bg-red-900/30"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : renters.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-emerald-800/30 dark:bg-[#132a1f] dark:text-gray-400">
          <User className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-base font-medium text-gray-700 dark:text-gray-300">لا يوجد مستأجرين</p>
          <p className="mt-1">يمكنك إضافة مستأجرين من صفحة جهات الاتصال.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {renters.map((r) => (
            <div
              key={r.id}
              className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-emerald-800/30 dark:bg-[#132a1f]"
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{r.name}</h3>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                      ].join(" ")}
                    >
                      {toArabicStatus(r.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="mb-4 space-y-2 text-sm">
                {r.phone ? (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300" dir="ltr">
                    <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span>{r.phone}</span>
                  </div>
                ) : null}
                {r.alternative_phone ? (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300" dir="ltr">
                    <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-500">{r.alternative_phone}</span>
                  </div>
                ) : null}
                {r.email ? (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span>{r.email}</span>
                  </div>
                ) : null}
                {r.id_number ? (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <IdCard className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span>رقم الهوية: {r.id_number}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span>الجنس: {toArabicSex(r.sex)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>تاريخ الإضافة: {new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                </div>
                {r.notes ? (
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <FileText className="mt-0.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="line-clamp-2">{r.notes}</span>
                  </div>
                ) : null}
                {(() => {
                  const contract = getActiveContractForRenter(contractsQuery.data ?? [], r.id);
                  const payments = contract ? paymentsByContract.get(contract.id) ?? [] : [];
                  const nextPayment = getNextPayment(payments);
                  return (
                    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm dark:border-emerald-800/30 dark:bg-emerald-950/20">
                      {contract ? (
                        <div className="space-y-2">
                          {getContractNumber(contract) ? (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <span>رقم العقد: {getContractNumber(contract)}</span>
                            </div>
                          ) : null}
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <span>بداية العقد: {formatDate(contract.start_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <span>نهاية العقد: {formatDate(contract.end_date)}</span>
                          </div>
                          {contract.payment_frequency ? (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Repeat className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <span>طريقة الدفع: {toArabicFrequency(contract.payment_frequency)}</span>
                            </div>
                          ) : null}
                          {nextPayment ? (
                            <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                              <Coins className="mt-0.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <span>القسط القادم: {formatCurrency(nextPayment.amount_sar)} بتاريخ {formatDate(nextPayment.due_date)}</span>
                            </div>
                          ) : payments.length > 0 ? (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Coins className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <span>جميع الدفعات مسددة</span>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setPaymentsModalContract(contract)}
                            className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            عرض وصلات الدفع
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <FileText className="h-4 w-4" />
                          <span>لا يوجد عقد نشط</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-emerald-800/30">
                <button
                  type="button"
                  onClick={() => void handleMessage(r.id)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <MessageSquare className="h-4 w-4" />
                  مراسلة
                </button>
                <button
                  type="button"
                  onClick={() => openContractModal(r)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                >
                  <Plus className="h-4 w-4" />
                  إنشاء عقد
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPaymentContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-emerald-800/40 dark:bg-[#132a1f]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">وصلات الدفع</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {selectedPaymentContract.contract.contact_id
                    ? `رقم العقد: ${getContractNumber(selectedPaymentContract.contract) || "—"}`
                    : "لا يوجد رقم عقد"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentsModalContract(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-emerald-900/30 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedPaymentContract.payments.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-emerald-800/30 dark:bg-[#132a1f] dark:text-gray-400">
                لا توجد وصلات دفع مولدة لهذا العقد.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-emerald-800/30">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <thead className="bg-gray-50 text-gray-700 dark:bg-emerald-950/30 dark:text-gray-200">
                    <tr>
                      <th className="px-4 py-3">القسط</th>
                      <th className="px-4 py-3">المبلغ</th>
                      <th className="px-4 py-3">تاريخ الاستحقاق</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3">تاريخ السداد</th>
                      <th className="px-4 py-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white dark:divide-emerald-900/30 dark:bg-[#132a1f]">
                    {selectedPaymentContract.payments.map((payment, index) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {payment.notes || `قسط ${index + 1}`}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(payment.amount_sar)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(payment.due_date)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              payment.status === "paid"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
                            ].join(" ")}
                          >
                            {toArabicPaymentStatus(payment.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(payment.paid_at)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{payment.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPaymentsModalContract(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/40 dark:bg-[#1a3528] dark:text-gray-300 dark:hover:bg-emerald-900/20"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Creation Modal */}
      {modalOpen && selectedRenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-emerald-800/40 dark:bg-[#132a1f]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">إنشاء عقد إيجار</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">للمستأجر: {selectedRenter.name}</p>
              </div>
              <button
                type="button"
                onClick={() => { setModalOpen(false); resetForm(); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-emerald-900/30 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmitContract} className="space-y-4">
              {/* Property */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Building2 className="inline h-4 w-4 ml-1" />
                  العقار
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => { setPropertyId(e.target.value); setUnitId(""); }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  required
                >
                  <option value="">اختر العقار...</option>
                  {propertiesQuery.data?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {propertiesQuery.isLoading && <p className="mt-1 text-xs text-gray-400">جاري تحميل العقارات...</p>}
              </div>

              {/* Unit */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <DoorOpen className="inline h-4 w-4 ml-1" />
                  الوحدة (اختياري)
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={!propertyId || unitsQuery.isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">اختر الوحدة...</option>
                  {unitsQuery.data?.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <FileText className="inline h-4 w-4 ml-1" />
                  رقم عقد الإيجار
                </label>
                <input
                  type="text"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="أدخل رقم العقد"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Calendar className="inline h-4 w-4 ml-1" />
                    تاريخ البدء
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Calendar className="inline h-4 w-4 ml-1" />
                    تاريخ النهاية (الأكبر)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                </div>
              </div>

              {/* Rent & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Coins className="inline h-4 w-4 ml-1" />
                    إجمالي الإيجار (ر.س)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    placeholder="مثلاً 24000"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Repeat className="inline h-4 w-4 ml-1" />
                    تكرار الدفع
                  </label>
                  <select
                    value={paymentFrequency}
                    onChange={(e) => setPaymentFrequency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي</option>
                    <option value="half-yearly">نصف سنوي</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>
              </div>

              {/* Installments count */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <ClipboardList className="inline h-4 w-4 ml-1" />
                  عدد الدفعات (اختياري)
                </label>
                <input
                  type="number"
                  min={1}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <FileText className="inline h-4 w-4 ml-1" />
                  ملاحظات
                </label>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  rows={3}
                  placeholder="أي ملاحظات إضافية..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createContractMutation.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {createContractMutation.isPending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {createContractMutation.isPending ? "جاري الحفظ..." : "حفظ العقد"}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); resetForm(); }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/40 dark:bg-[#1a3528] dark:text-gray-300 dark:hover:bg-emerald-900/20"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
