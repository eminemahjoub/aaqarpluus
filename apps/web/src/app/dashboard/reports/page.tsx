"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  TrendingUp,
  FileText,
  Home,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  Search,
  Filter,
  ChevronLeft,
  Crown,
  X,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
// Report Types
const reportCategories = [
  {
    id: "financial",
    title: "التقارير المالية (المؤجر)",
    reports: [
      { id: "income", label: "تقرير الدخل", icon: DollarSign, color: "bg-indigo-600" },
      { id: "income-details", label: "تقرير تفاصيل الدخل", icon: LineChart, color: "bg-indigo-600" },
      { id: "payments", label: "تقرير الدفعات", icon: FileText, color: "bg-indigo-600" },
      { id: "invoices", label: "تقرير الفواتير العربية", icon: FileText, color: "bg-yellow-500" },
    ],
  },
  {
    id: "manager",
    title: "التقارير المالية (مدير الأملاك)",
    reports: [
      { id: "commission", label: "تقرير دفعات السعي", icon: DollarSign, color: "bg-yellow-500" },
      { id: "profits", label: "تقرير الأرباح", icon: TrendingUp, color: "bg-yellow-500" },
    ],
  },
  {
    id: "operational",
    title: "التقارير التشغيلية",
    reports: [
      { id: "contracts", label: "تقرير العقود", icon: FileText, color: "bg-pink-500" },
      { id: "vacancy", label: "تقرير شاغرية الوحدات العقارية", icon: Home, color: "bg-pink-500" },
    ],
  },
  {
    id: "investment",
    title: "التقارير الاستثمارية",
    reports: [
      { id: "investment", label: "تقرير الاستثمار", icon: BarChart3, color: "bg-cyan-500" },
    ],
  },
];

// Types
interface IncomeRow {
  id: string;
  property: string;
  tenant: string;
  contractStart: string;
  contractEnd: string;
  income: number;
  expenses: number;
  net: number;
}

interface IncomeDetailsRow {
  id: string;
  property: string;
  tenant: string;
  contractStart: string;
  contractEnd: string;
  payments: string;
  amount: number;
  status: string;
}

interface PaymentRow {
  id: string;
  property: string;
  tenant: string;
  unit: string;
  contractStart: string;
  paymentType: string;
  paymentStatus: string;
  amount: number;
  dueDate: string;
  paidDate: string;
}

interface InvoiceRow {
  id: string;
  property: string;
  tenant: string;
  installments: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  paymentStatus: string;
}

interface CommissionRow {
  id: string;
  property: string;
  tenant: string;
  observations: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  paymentStatus: string;
}

interface ProfitsRow {
  id: string;
  property: string;
  tenant: string;
  rentalIncome: number;
  otherIncome: number;
  expenses: number;
  netProfit: number;
}

interface ContractRow {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  phone: string;
  contractStart: string;
  contractRenewal: string;
  contractEnd: string;
  amount: number;
  contractStatus: string;
}

interface VacancyRow {
  id: string;
  property: string;
  tenant: string;
  phone: string;
  contractStart: string;
  contractEnd: string;
  nextRenewal: string;
  status: string;
}

interface InvestmentRow {
  id: string;
  property: string;
  tenant: string;
  contractStart: string;
  contractEnd: string;
  rentalIncome: number;
  expenses: number;
  netProfit: number;
}

export function ReportsContent() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  if (selectedReport) {
    return <ReportDetail reportId={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقارير</h1>
        </div>

        {/* Report Categories */}
        <div className="space-y-8">
          {reportCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {category.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report.id)}
                      className={`flex items-center justify-between rounded-xl ${report.color} px-4 py-4 text-white transition hover:opacity-90`}
                    >
                      <span className="font-medium">{report.label}</span>
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center dark:border-emerald-800/50 dark:bg-[#132a1f]/50">
          <BarChart3 className="mx-auto h-16 w-16 text-gray-300 dark:text-emerald-700" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            اختر أحد التقارير أعلاه لعرض التفاصيل
          </p>
        </div>
      </div>
  );
}

export default function ReportsPage() {
  return (
    <DashboardLayout role="owner">
      <ReportsContent />
    </DashboardLayout>
  );
}

function ReportDetail({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const todayYmd = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(todayYmd);
  const [dateTo, setDateTo] = useState(todayYmd);
  const [propertyId, setPropertyId] = useState<string>("");
  const [complex, setComplex] = useState("");
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"" | "paid" | "pending">("");
  const [contractStatus, setContractStatus] = useState<"" | "active" | "ended" | "cancelled">("");
  const [tenantId, setTenantId] = useState<string>("");
  const [includeTenant, setIncludeTenant] = useState(false);
  const [searchTick, setSearchTick] = useState(0);

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);

  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const [incomeDetailsRows, setIncomeDetailsRows] = useState<IncomeDetailsRow[]>([]);
  const [paymentsRows, setPaymentsRows] = useState<PaymentRow[]>([]);
  const [invoicesRows, setInvoicesRows] = useState<InvoiceRow[]>([]);
  const [commissionRows, setCommissionRows] = useState<CommissionRow[]>([]);
  const [profitsRows, setProfitsRows] = useState<ProfitsRow[]>([]);
  const [contractsRows, setContractsRows] = useState<ContractRow[]>([]);
  const [vacancyRows, setVacancyRows] = useState<VacancyRow[]>([]);
  const [investmentRows, setInvestmentRows] = useState<InvestmentRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [propsRes, contactsRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/contacts"),
      ]);
      if (cancelled) return;
      const [props, contacts] = await Promise.all([
        propsRes.ok ? propsRes.json() : [],
        contactsRes.ok ? contactsRes.json() : [],
      ]);
      if (cancelled) return;
      setProperties((props ?? []).map((p: any) => ({ id: String(p.id), name: String(p.name ?? "—") })));
      setTenants((contacts ?? []).filter((c: any) => c.type === "tenant").map((c: any) => ({ id: String(c.id), name: String(c.name ?? "—"), phone: c.phone ? String(c.phone) : null })));
    })();
    return () => { cancelled = true; };
  }, []);

  const applySearch = async () => {
    setSearchTick((v) => v + 1);

    const params = new URLSearchParams({
      type: reportId,
      from: dateFrom,
      to: dateTo,
    });
    if (propertyId) params.set("property_id", propertyId);
    if (tenantId) params.set("contact_id", tenantId);
    if (paymentStatus) params.set("payment_status", paymentStatus);
    if (contractStatus) params.set("contract_status", contractStatus);

    const res = await fetch(`/api/reports?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();

    if (reportId === "vacancy") {
      setVacancyRows(
        (data ?? []).map((r: any) => ({
          id: String(r.property_id ?? r.property_name ?? Math.random()),
          property: String(r.property_name ?? "—"),
          tenant: "—",
          phone: "—",
          contractStart: "—",
          contractEnd: "—",
          nextRenewal: "—",
          status: `إشغال: ${(Number(r.occupancy_rate_percent) || 0).toFixed(0)}%`,
        })),
      );
    } else if (reportId === "income") {
      setIncomeRows(
        (data ?? []).map((r: any) => ({
          id: String(r.month ?? Math.random()),
          property: String(r.month ?? "—"),
          tenant: "—",
          contractStart: "—",
          contractEnd: "—",
          income: Number(r.income_sar) || 0,
          expenses: Number(r.expenses_sar) || 0,
          net: Number(r.net_sar) || 0,
        })),
      );
    } else if (reportId === "payments") {
      setPaymentsRows(
        (data ?? []).map((r: any) => ({
          id: String(r.id),
          property: String(r.property_name ?? "—"),
          unit: String(r.unit_label ?? "—"),
          tenant: String(r.contact_name ?? "—"),
          contractStart: r.contract_start ? String(r.contract_start) : "—",
          paymentType: "إيجار",
          paymentStatus: String(r.status ?? "—"),
          amount: Number(r.amount_sar) || 0,
          dueDate: r.due_date ? String(r.due_date) : "—",
          paidDate: r.paid_at ? String(r.paid_at).slice(0, 10) : "—",
        })),
      );
    } else if (reportId === "contracts") {
      setContractsRows(
        (data ?? []).map((c: any) => ({
          id: String(c.id),
          property: String(c.property_name ?? "—"),
          unit: String(c.unit_label ?? "—"),
          tenant: String(c.contact_name ?? "—"),
          phone: c.contact_phone ? String(c.contact_phone) : "—",
          contractStart: c.start_date ? String(c.start_date) : "—",
          contractRenewal: "—",
          contractEnd: c.end_date ? String(c.end_date) : "—",
          amount: Number(c.rent_total_sar) || 0,
          contractStatus: String(c.status ?? "—"),
        })),
      );
    } else {
      setIncomeRows([]);
      setIncomeDetailsRows([]);
      setPaymentsRows([]);
      setInvoicesRows([]);
      setCommissionRows([]);
      setProfitsRows([]);
      setContractsRows([]);
      setVacancyRows([]);
      setInvestmentRows([]);
    }
  };

  const exportCurrentReport = () => {
    const header = ["report", "from", "to", "property", "complex", "paymentStatus", "contractStatus"];
    const row = [reportId, dateFrom, dateTo, propertyId || "—", complex || "—", paymentStatus || "—", contractStatus || "—"];
    const csv = [header.join(","), row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${reportId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getReportTitle = () => {
    for (const cat of reportCategories) {
      const report = cat.reports.find((r) => r.id === reportId);
      if (report) return report.label;
    }
    return "تقرير";
  };

  const getCategoryTitle = () => {
    for (const cat of reportCategories) {
      if (cat.reports.find((r) => r.id === reportId)) return cat.title;
    }
    return "";
  };

  const renderFilters = () => {
    switch (reportId) {
      case "income":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option>المالك الحالي</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">{showAllProperties ? "الكل" : "اختر"}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ البداية
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ النهاية
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showAllProperties}
                    onChange={(e) => setShowAllProperties(e.target.checked)}
                    className="rounded border-gray-300 dark:border-emerald-800/50"
                  />
                  إظهار جميع العقارات
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
              </div>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                بحث
              </button>
            </div>
          </div>
        );

      case "income-details":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ البداية
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ النهاية
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showAllProperties}
                    onChange={(e) => setShowAllProperties(e.target.checked)}
                    className="rounded border-gray-300 dark:border-emerald-800/50"
                  />
                  إظهار جميع العقارات
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={includeTenant}
                    onChange={(e) => setIncludeTenant(e.target.checked)}
                    className="rounded border-gray-300 dark:border-emerald-800/50"
                  />
                  إظهار المستأجر في التقرير
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
              </div>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                بحث
              </button>
            </div>
          </div>
        );

      case "payments":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option>المالك الحالي</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">{showAllProperties ? "الكل" : "اختر"}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المستأجر
                </label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">الكل</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  نوع الدفعات
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  حالة الدفع
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">الكل</option>
                  <option value="paid">مدفوعة</option>
                  <option value="pending">غير مدفوعة</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showAllUnits}
                  onChange={(e) => setShowAllUnits(e.target.checked)}
                  className="rounded border-gray-300 dark:border-emerald-800/50"
                />
                إظهار ملاحظات التواصل
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                بحث
              </button>
            </div>
          </div>
        );

      case "invoices":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                بحث
              </button>
            </div>
          </div>
        );

      case "commission":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                حالة الدفع
              </label>
              <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white sm:w-64">
                <option>اختر</option>
              </select>
            </div>
            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                بحث
              </button>
            </div>
          </div>
        );

      case "profits":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showAllProperties}
                  onChange={(e) => setShowAllProperties(e.target.checked)}
                  className="rounded border-gray-300 dark:border-emerald-800/50"
                />
                إظهار جميع العقارات
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
              <button className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                بحث
              </button>
            </div>
          </div>
        );

      case "contracts":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option>المالك الحالي</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">{showAllProperties ? "الكل" : "اختر"}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                حالة العقد
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={contractStatus}
                  onChange={(e) => setContractStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">الكل</option>
                  <option value="active">ساري</option>
                  <option value="ended">منتهي</option>
                  <option value="cancelled">ملغي</option>
                </select>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">كل المستأجرين</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                بحث
              </button>
            </div>
          </div>
        );

      case "vacancy":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  حالة الوحدة
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>الكل</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                بحث
              </button>
            </div>
          </div>
        );

      case "investment":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المؤجر
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  العقار / المجمع
                </label>
                <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                  <option>اختر</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ بداية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  تاريخ نهاية الاستحقاق
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-emerald-300 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showAllProperties}
                  onChange={(e) => setShowAllProperties(e.target.checked)}
                  className="rounded border-gray-300 dark:border-emerald-800/50"
                />
                إظهار جميع العقارات
              </label>
              <span className="text-sm text-gray-500 dark:text-gray-400">لا</span>
              <button className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                بحث
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderTable = () => {
    const emptyState = (
      <div className="py-12 text-center">
        <Search className="mx-auto h-12 w-12 text-gray-300 dark:text-emerald-700" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          {searchTick > 0 ? "لا توجد نتائج مطابقة" : "طبّق الفلاتر ثم اضغط (بحث)"}
        </p>
      </div>
    );

    switch (reportId) {
      case "income":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                  <th className="px-4 py-3 text-right font-medium">العقار</th>
                  <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                  <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                  <th className="px-4 py-3 text-right font-medium">إجمالي الإيرادات</th>
                  <th className="px-4 py-3 text-right font-medium">إجمالي المصروفات</th>
                  <th className="px-4 py-3 text-right font-medium">صافي الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {incomeRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                ) : (
                  incomeRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.tenant}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.property}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractStart}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractEnd}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.income.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.expenses.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">{row.net.toLocaleString()} ر.س</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      case "income-details":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                  <th className="px-4 py-3 text-right font-medium">العقار</th>
                  <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                  <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                  <th className="px-4 py-3 text-right font-medium">المدفوعات</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {incomeDetailsRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                ) : (
                  incomeDetailsRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.tenant}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.property}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractStart}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractEnd}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.payments}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{row.amount.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      case "payments":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">الدفعات</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                    <th className="px-4 py-3 text-right font-medium">حالة الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الاستحقاق</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {paymentsRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        {emptyState}
                      </td>
                    </tr>
                  ) : (
                    paymentsRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.tenant}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.property}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractStart}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.unit}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.paymentStatus}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.amount.toLocaleString()} ر.س</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.dueDate}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.paidDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">الملخص</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">إجمالي الإيرادات</th>
                    <th className="px-4 py-3 text-right font-medium">إجمالي المصروفات</th>
                    <th className="px-4 py-3 text-right font-medium">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {paymentsRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center">
                        {emptyState}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      {(() => {
                        const total = paymentsRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
                        const paid = paymentsRows.reduce((acc, r) => acc + (String(r.paymentStatus) === "paid" ? Number(r.amount) || 0 : 0), 0);
                        const unpaid = total - paid;
                        return (
                          <>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">{total.toLocaleString()} ر.س</td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">{unpaid.toLocaleString()} ر.س</td>
                            <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">{paid.toLocaleString()} ر.س</td>
                          </>
                        );
                      })()}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "invoices":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                  <th className="px-4 py-3 text-right font-medium">العقار</th>
                  <th className="px-4 py-3 text-right font-medium">الأقساط</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium">تاريخ الاستحقاق</th>
                  <th className="px-4 py-3 text-right font-medium">تاريخ الدفع</th>
                  <th className="px-4 py-3 text-right font-medium">حالة الدفع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    {emptyState}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      case "commission":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">السعي</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">ملاحظات</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الاستحقاق</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">حالة الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "profits":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">الأرباح</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">إيرادات الإيجار</th>
                    <th className="px-4 py-3 text-right font-medium">إيرادات أخرى</th>
                    <th className="px-4 py-3 text-right font-medium">المصروفات</th>
                    <th className="px-4 py-3 text-right font-medium">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "contracts":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">سجل العقود</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                    <th className="px-4 py-3 text-right font-medium">رقم الجوال</th>
                    <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ التجديد</th>
                    <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">حالة العقد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {contractsRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        {emptyState}
                      </td>
                    </tr>
                  ) : (
                    contractsRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.tenant}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.property}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.unit}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400" dir="ltr">
                          {row.phone}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractStart}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractRenewal}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.contractEnd}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{row.amount.toLocaleString()} ر.س</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.contractStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "vacancy":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">العقود النشطة</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">رقم الجوال</th>
                    <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">التجديد القادم</th>
                    <th className="px-4 py-3 text-right font-medium">الدفعات</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "investment":
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">الدخل لكل عقار</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    <th className="px-4 py-3 text-right font-medium">العقار</th>
                    <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">إيرادات الإيجار</th>
                    <th className="px-4 py-3 text-right font-medium">المصروفات</th>
                    <th className="px-4 py-3 text-right font-medium">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      {emptyState}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return emptyState;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-primary dark:text-gray-400"
        >
          <ChevronLeft className="h-4 w-4" />
          التقارير
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500 dark:text-gray-400">{getCategoryTitle()}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 dark:text-white">{getReportTitle()}</span>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{getReportTitle()}</h1>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        {renderFilters()}
      </div>

      {/* Export Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={exportCurrentReport}
          className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          <Download className="h-4 w-4" />
          تصدير التقرير
        </button>
      </div>

      {/* Results */}
      <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        {renderTable()}
      </div>
    </div>
  );
}
