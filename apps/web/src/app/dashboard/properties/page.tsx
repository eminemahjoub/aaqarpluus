"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { hijriYmdFromGregorianYmd } from "@/lib/hijri";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";
import { useCanMutate } from "@/hooks/useCanMutate";
import { OwnerContractSummaryCards } from "@/components/dashboard/OwnerContractSummaryCards";
import type { OwnerContractSummary } from "@/lib/owner-tenant-privacy";
import { formatDaysUntilAr } from "@/lib/owner-tenant-privacy";
import {
  Building2,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Percent,
  ChevronLeft,
  ChevronRight,
  Home,
  Phone,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowRight,
  Edit,
  Pencil,
  Save,
  Trash2,
  Printer,
  Download,
  X,
  Upload,
  Info,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Calculator,
  Copy,
  Eye,
  Ban,
  Sparkles,
  Search as SearchIcon,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";

// Saudi locations (lightweight, curated).
// Regions cover the 13 administrative regions. Cities list is representative and can be expanded.
const SA_REGIONS = [
  "منطقة الرياض",
  "منطقة مكة المكرمة",
  "منطقة المدينة المنورة",
  "منطقة القصيم",
  "المنطقة الشرقية",
  "منطقة عسير",
  "منطقة تبوك",
  "منطقة حائل",
  "منطقة الحدود الشمالية",
  "منطقة جازان",
  "منطقة نجران",
  "منطقة الباحة",
  "منطقة الجوف",
] as const;

const SA_CITIES_BY_REGION: Record<(typeof SA_REGIONS)[number], string[]> = {
  "منطقة الرياض": ["الرياض", "الخرج", "الدرعية", "الدوادمي", "المجمعة", "وادي الدواسر", "القويعية", "الزلفي", "شقراء", "حوطة بني تميم"],
  "منطقة مكة المكرمة": ["مكة المكرمة", "جدة", "الطائف", "القنفذة", "الليث", "رابغ", "خليص", "الجموم", "بحرة"],
  "منطقة المدينة المنورة": ["المدينة المنورة", "ينبع", "العلا", "مهد الذهب", "بدر", "خيبر"],
  "منطقة القصيم": ["بريدة", "عنيزة", "الرس", "المذنب", "البكيرية", "البدائع"],
  "المنطقة الشرقية": ["الدمام", "الخبر", "الظهران", "القطيف", "الأحساء", "الجبيل", "حفر الباطن", "النعيرية", "رأس تنورة"],
  "منطقة عسير": ["أبها", "خميس مشيط", "بيشة", "محايل عسير", "النماص", "ظهران الجنوب"],
  "منطقة تبوك": ["تبوك", "ضباء", "الوجه", "أملج", "حقل"],
  "منطقة حائل": ["حائل", "بقعاء", "الغزالة", "الشنان"],
  "منطقة الحدود الشمالية": ["عرعر", "رفحاء", "طريف", "العويقيلة"],
  "منطقة جازان": ["جازان", "صبيا", "أبو عريش", "صامطة", "الدرب", "بيش"],
  "منطقة نجران": ["نجران", "شرورة", "حبونا"],
  "منطقة الباحة": ["الباحة", "بلجرشي", "المندق", "المخواة"],
  "منطقة الجوف": ["سكاكا", "القريات", "دومة الجندل"],
};

const SA_NEIGHBORHOODS_BY_CITY: Record<string, string[]> = {
  الرياض: ["النرجس", "الياسمين", "الملقا", "حطين", "العقيق", "الورود", "الصحافة", "الروضة", "النسيم", "العليا", "الشفا", "السويدي"],
  جدة: ["الروضة", "الزهراء", "السلامة", "الصفا", "المروة", "النهضة", "الحمراء", "الفيصلية"],
  "مكة المكرمة": ["العزيزية", "الشوقية", "العوالي", "النسيم", "الشرائع"],
  "المدينة المنورة": ["العزيزية", "العيون", "الدفاع", "قباء", "الجامعة"],
  الدمام: ["الشاطئ", "الفيصلية", "الزهور", "الروضة", "النور"],
  الخبر: ["العقربية", "الحزام", "الثقبة", "اليرموك", "البندرية"],
  أبها: ["المنهل", "الشمسان", "العرين", "المروج"],
  "خميس مشيط": ["الراقي", "الضمك", "الشرفة", "المصيف"],
};

function citiesForRegion(region: string) {
  return (SA_CITIES_BY_REGION as any)[region] ? (SA_CITIES_BY_REGION as any)[region] : [];
}

function neighborhoodsForCity(city: string) {
  return SA_NEIGHBORHOODS_BY_CITY[city] ?? [];
}

type OfficeContactOption = { id: string; name: string; phone?: string | null; type?: string };

function useOfficeContacts(isOpen: boolean) {
  const [offices, setOffices] = useState<OfficeContactOption[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/contacts");
        if (!res.ok) return;
        const data: unknown = await res.json();
        const list = Array.isArray(data) ? data : [];
        const filtered = (list as OfficeContactOption[]).filter((c) => c.type === "office");
        if (!cancelled) setOffices(filtered);
      } catch {
        if (!cancelled) setOffices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);
  return offices;
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function googleMapsEmbedSrc(args: { latitude?: unknown; longitude?: unknown; addressText?: string | null }) {
  const lat = toNumOrNull(args.latitude);
  const lng = toNumOrNull(args.longitude);
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=15&output=embed`;
  }
  const q = (args.addressText ?? "").trim();
  if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
  return null;
}

function googleMapsLink(args: { latitude?: unknown; longitude?: unknown; addressText?: string | null }) {
  const lat = toNumOrNull(args.latitude);
  const lng = toNumOrNull(args.longitude);
  if (lat !== null && lng !== null) return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
  const q = (args.addressText ?? "").trim();
  if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
  return null;
}

// Types & Interfaces
type DbProperty = {
  id: string;
  name: string;
  title: string | null;
  status: "active" | "expired" | "vacant";
  region: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  property_model_type: string | null;
  cover_url: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  managing_office_name?: string | null;
  managing_office_phone?: string | null;
  managing_office_email?: string | null;
  units_count: number;
  apartments_count: number;
  shops_count: number;
  other_units_count: number;
  unit_identifiers: string | null;
  area_m2: number | null;
  property_cost: number | null;
  created_at: string;
  payment_frequency?: string | null;
  lessor_type?: string | null;
  lessor_contact_id?: string | null;
  commission_percent?: number | null;
  electricity_account?: string | null;
  water_account?: string | null;
};

interface Expense {
  id: string;
  type: string;
  amount: number;
  status: "مسدد" | "غير مسدد" | "معلق";
  date?: string;
  contact?: string;
  notes?: string;
  paidSince?: string;
}

interface Revenue {
  id: string;
  type: string;
  amount: number;
  status: "مسدد" | "غير مسدد" | "معلق";
  date: string;
  method: string;
  contact?: string;
}

interface Contract {
  id: number;
  tenant: string;
  startDate: string;
  endDate: string;
  rent: number;
  status: "ساري" | "منتهي" | "ملغي";
  contractNumber?: string;
  mobile?: string;
  payments?: string;
  paymentStatus?: "مدفوعة" | "معلقة";
  contractStatus?: "ساري";
}

interface Installment {
  id: number;
  amount: number;
  date: string;
  type: string;
  direction: string;
  notes?: string;
}

interface Insurance {
  id: number;
  amount: number;
  date: string;
  type: string;
  direction: string;
  repeatCount?: number;
  repeatInterval?: string;
  notes?: string;
  paymentStatus?: "مسدد" | "غير مسدد";
}

// All data comes from Supabase.

// ============================================================================
// MODAL COMPONENT
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative w-full ${sizeClasses[size]} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-[#1a3528] dark:text-gray-400 dark:hover:bg-[#223a2d]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ADD PROPERTY CHOICE MODAL
// ============================================================================

function AddPropertyChoiceModal({ isOpen, onClose, onSelect }: { isOpen: boolean; onClose: () => void; onSelect: (type: "single" | "complex") => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة عقار جديد" size="md">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onSelect("single")}
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 p-6 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">إضافة عقار</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">(شقة - دور - عمارة بمستأجر وحيد وغيرها)</p>
          </div>
        </button>
        <button
          onClick={() => onSelect("complex")}
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 p-6 transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-white">إضافة مجمع</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">(عمارة - مجمع سكني تجاري وغيرها)</p>
          </div>
        </button>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD COMPLEX MODAL
// ============================================================================

function AddComplexModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    region: "",
    city: "",
    neighborhood: "",
    address: "",
    titleDeedNumber: "",
    propertyArea: "",
    waterAccount: "",
    electricityAccount: "",
    description: "",
    propertyCost: "",
    apartmentsCount: "",
    shopsCount: "",
  });

  const totalUnitsFromCounts = React.useMemo(() => {
    const a = Number(formData.apartmentsCount || 0);
    const s = Number(formData.shopsCount || 0);
    return [a, s].reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
  }, [formData.apartmentsCount, formData.shopsCount]);

  const complexCityOptions = React.useMemo<string[]>(() => citiesForRegion(formData.region), [formData.region]);
  const complexNeighborhoodOptions = React.useMemo<string[]>(() => neighborhoodsForCity(formData.city), [formData.city]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    void (async () => {
      const res = await authFetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          title: formData.title.trim() || null,
          region: formData.region || null,
          city: formData.city || null,
          neighborhood: formData.neighborhood || null,
          address: formData.address.trim() || null,
          area_m2: formData.propertyArea ? Number(formData.propertyArea) : null,
          property_cost: formData.propertyCost ? Number(formData.propertyCost) : null,
          status: "vacant",
          property_model_type: "مجمع",
          apartments_count: Number(formData.apartmentsCount || 0),
          shops_count: Number(formData.shopsCount || 0),
          other_units_count: 0,
          units_count: totalUnitsFromCounts,
        }),
      });
      setSaving(false);
      if (!res.ok) return;
      const inserted = await res.json();
      if (!inserted?.id) return;
      // Upload any pending images
      for (const file of pendingImages) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("property_id", inserted.id);
        fd.append("image_type", "gallery");
        await authFetch("/api/property-images", { method: "POST", body: fd });
      }
      router.push(`/dashboard/properties/units?property_id=${inserted.id}`);
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مجمع جديد" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              الاسم
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="وصف المجمع..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              المنطقة
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <select
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value, city: "", neighborhood: "" })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر المنطقة</option>
              {SA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              المدينة
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <select
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value, neighborhood: "" })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر المدينة</option>
              {complexCityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الحي</label>
            <select
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر الحي</option>
              {complexNeighborhoodOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            الوصف
            <Info className="h-4 w-4 text-indigo-600" />
          </label>
          <textarea
            placeholder="عنوان المجمع..."
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              العنوان
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="عنوان العقار..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              رقم الصك
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="رقم صك الملكية"
              value={formData.titleDeedNumber || ""}
              onChange={(e) => setFormData({ ...formData, titleDeedNumber: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب المياه</label>
            <input
              type="text"
              placeholder="0"
              value={formData.waterAccount || ""}
              onChange={(e) => setFormData({ ...formData, waterAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب الكهرباء</label>
            <input
              type="text"
              placeholder="0"
              value={formData.electricityAccount || ""}
              onChange={(e) => setFormData({ ...formData, electricityAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الوصف</label>
            <textarea
              placeholder="شارع فرعي"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">مساحة العقار</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0"
                value={formData.propertyArea}
                onChange={(e) => setFormData({ ...formData, propertyArea: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              />
              <span className="flex items-center text-sm text-gray-500">م²</span>
            </div>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">قيمة تكلفة العقار</label>
            <input
              type="number"
              placeholder="300,000"
              value={formData.propertyCost || ""}
              onChange={(e) => setFormData({ ...formData, propertyCost: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">الوحدات</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">عدد الشقق</label>
              <input
                type="number"
                min={0}
                max={200}
                placeholder="مثال: 5"
                value={formData.apartmentsCount}
                onChange={(e) => setFormData({ ...formData, apartmentsCount: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">عدد المحلات</label>
              <input
                type="number"
                min={0}
                max={200}
                placeholder="مثال: 2"
                value={formData.shopsCount}
                onChange={(e) => setFormData({ ...formData, shopsCount: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">إجمالي الوحدات: {totalUnitsFromCounts}</p>
        </div>

        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition hover:border-indigo-400 dark:border-emerald-800/50 dark:hover:border-indigo-500">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {pendingImages.length > 0 ? `${pendingImages.length} صورة محددة` : "إرفع صور العقار"}
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setPendingImages(Array.from(e.target.files ?? []))}
          />
        </label>
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingImages.map((f, i) => (
              <div key={i} className="relative h-16 w-16">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            الغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "جاري الإنشاء..." : "إنشاء"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// ADD SINGLE PROPERTY MODAL
// ============================================================================

function AddPropertyModal({ isOpen, onClose, userType }: { isOpen: boolean; onClose: () => void; userType: "owner" | "agency" | "personal" }) {
  const router = useRouter();
  const [agencyOffices, setAgencyOffices] = useState<{ officeId: string; officeName: string }[]>([]);
  const [linkedOwners, setLinkedOwners] = useState<Array<{ owner_id: string; full_name: string | null; email: string | null; phone: string | null }>>([]);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ownerId: "",
    propertyNumber: "2",
    name: "",
    region: "",
    city: "",
    neighborhood: "",
    address: "",
    title: "",
    description: "",
    propertyModelType: "building",
    unitsCount: "1",
    apartmentsCount: "",
    shopsCount: "",
    unitIdentifiers: "",
    contractDuration: "شهري",
    commissionPercent: "",
    managingOfficeId: "",
    lessorType: "owner" as "owner" | "office",
    area: "",
    annualRent: "30000",
    rentWithAddition: "30000",
    startDate: "2025-04-01",
    endDate: "2026-04-01",
    monthsCount: "12",
    includeFees: false,
    contractTerms: "الشروط الافتراضية",
    notes: "",
    electricityAccount: "",
    waterAccount: "",
    propertyCost: "",
  });

  const cityOptions = React.useMemo(() => citiesForRegion(formData.region), [formData.region]);
  const neighborhoodOptions = React.useMemo(() => neighborhoodsForCity(formData.city), [formData.city]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        if (userType === "agency") {
          const res = await authFetch("/api/offices/owners");
          const data = res.ok ? await res.json() : [];
          const owners = Array.isArray(data)
            ? data.map((r: any) => ({
                owner_id: String(r.owner_id),
                full_name: r.full_name ? String(r.full_name) : null,
                email: r.email ? String(r.email) : null,
                phone: r.phone ? String(r.phone) : null,
              }))
            : [];
          if (!cancelled) setLinkedOwners(owners);
        } else {
          const res = await authFetch("/api/owner/agencies");
          const data = res.ok ? await res.json() : [];
          const offices = Array.isArray(data)
            ? data.map((g: any) => ({ officeId: String(g.officeId), officeName: String(g.officeName ?? "—") }))
            : [];
          if (!cancelled) setAgencyOffices(offices);
        }
      } catch {
        if (!cancelled) {
          setAgencyOffices([]);
          setLinkedOwners([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = totalUnitsFromCounts;
    if (userType === "agency" && !formData.ownerId.trim()) {
      setStructureError("يرجى اختيار المالك.");
      return;
    }
    if (userType === "agency" && !formData.commissionPercent?.trim()) {
      setStructureError("يرجى إدخال نسبة العمولة.");
      return;
    }
    if (userType === "agency") {
      const n = formData.commissionPercent?.trim() ? Number(formData.commissionPercent) : null;
      if (n === null || !Number.isFinite(n) || n < 0 || n > 100) {
        setStructureError("نسبة العمولة يجب أن تكون رقمًا بين 0 و 100.");
        return;
      }
    }
    if (formData.lessorType === "office" && !formData.managingOfficeId?.trim()) {
      setStructureError("يرجى اختيار المكتب.");
      return;
    }
    if (formData.lessorType === "office" && !formData.commissionPercent?.trim()) {
      setStructureError("يرجى إدخال نسبة العمولة للمكتب.");
      return;
    }
    const commissionNum =
      formData.lessorType === "office" && formData.commissionPercent?.trim()
        ? Number(formData.commissionPercent)
        : null;
    if (
      formData.lessorType === "office" &&
      (commissionNum === null || !Number.isFinite(commissionNum) || commissionNum < 0 || commissionNum > 100)
    ) {
      setStructureError("نسبة العمولة يجب أن تكون رقمًا بين 0 و 100.");
      return;
    }
    if (total <= 0) {
      setStructureError("يرجى إدخال عدد الوحدات (شقق أو محلات).");
      return;
    }
    setStructureError(null);
    setSaving(true);

    const res = await authFetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: userType === "agency" ? formData.ownerId.trim() : undefined,
        name: (formData.name || formData.title || "عقار").trim(),
        title: formData.title?.trim() || null,
        description: formData.description?.trim() || null,
        status: "vacant",
        region: formData.region || null,
        city: formData.city || null,
        neighborhood: formData.neighborhood || null,
        address: formData.address || null,
        property_model_type: formData.propertyModelType || null,
        apartments_count: Number(formData.apartmentsCount || 0),
        shops_count: Number(formData.shopsCount || 0),
        other_units_count: 0,
        unit_identifiers: formData.unitIdentifiers?.trim() || null,
        units_count: total,
        area_m2: formData.area ? Number(formData.area) : null,
        property_cost: formData.propertyCost ? Number(formData.propertyCost) : null,
        water_account: formData.waterAccount?.trim() || null,
        electricity_account: formData.electricityAccount?.trim() || null,
        payment_frequency: formData.contractDuration?.trim() || null,
        lessor_type: userType === "agency" ? "office" : formData.lessorType,
        lessor_contact_id: null,
        managing_office_id:
          userType === "agency"
            ? null
            : formData.lessorType === "office" && formData.managingOfficeId?.trim()
              ? formData.managingOfficeId.trim()
              : null,
        commission_percent:
          userType === "agency"
            ? (formData.commissionPercent?.trim() ? Number(formData.commissionPercent) : null)
            : formData.lessorType === "office" && formData.commissionPercent?.trim()
              ? Number(formData.commissionPercent)
              : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const msg = errData?.error ?? "حدث خطأ أثناء إنشاء العقار.";
      console.error("[properties POST error]", res.status, msg, errData);
      setStructureError(msg);
      return;
    }
    const inserted = await res.json();
    if (!inserted?.id) return;

    // Upload pending images
    for (const file of pendingImages) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("property_id", inserted.id);
      fd.append("image_type", "gallery");
      await authFetch("/api/property-images", { method: "POST", body: fd });
    }
    if (userType === "agency") {
      router.push(`/agency/properties/units?property_id=${inserted.id}`);
      onClose();
    } else {
      router.push(`/dashboard/properties/units?property_id=${inserted.id}`);
      onClose();
    }
  };


  const totalUnitsFromCounts = React.useMemo(() => {
    const a = Number(formData.apartmentsCount || 0);
    const s = Number(formData.shopsCount || 0);
    const total = [a, s].reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
    return Math.max(0, Math.min(200, total));
  }, [formData.apartmentsCount, formData.shopsCount]);

  // تم نقل إكمال تفاصيل الوحدات إلى صفحة مستقلة بعد حفظ تفاصيل العقار

  async function generateNotes() {
    setGenError(null);
    setGenLoading(true);
    try {
      const rooms = Number(formData.apartmentsCount || 0) || Number(formData.unitsCount || 0) || totalUnitsFromCounts || 0;
      const surface = formData.area ? Number(formData.area) : 0;
      const type =
        formData.propertyModelType === "building"
          ? "apartment"
          : formData.propertyModelType === "complex"
            ? "commercial"
            : "apartment";
      const features = [
        formData.neighborhood ? `حي: ${formData.neighborhood}` : null,
        formData.includeFees ? "تشمل الرسوم" : null,
      ].filter(Boolean);

      const res = await fetch("/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          city: formData.city || "—",
          rooms: Number.isFinite(rooms) ? rooms : 0,
          surface: Number.isFinite(surface) ? surface : 0,
          features,
          language: "ar",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(j?.error ?? "تعذر توليد الوصف"));
      const desc = String(j?.description ?? "").trim();
      if (!desc) throw new Error("تعذر توليد الوصف");
      setFormData((p) => ({ ...p, description: desc }));
    } catch (e: any) {
      setGenError(e?.message ?? "تعذر توليد الوصف");
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة عقار جديد" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {userType === "agency" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800/40 dark:bg-[#0f1e14]">
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">المالك</p>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">اختر المالك</label>
            <select
              value={formData.ownerId}
              onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">—</option>
              {linkedOwners.map((o) => (
                <option key={o.owner_id} value={o.owner_id}>
                  {o.full_name ?? o.email ?? "مالك"}
                  {o.phone ? ` (${o.phone})` : ""}
                </option>
              ))}
            </select>
            {linkedOwners.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">لا توجد قائمة ملاك مرتبطة بالمكتب بعد.</p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نسبة العمولة (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="مثال: 5"
                  value={formData.commissionPercent}
                  onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              المجمع
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
              <option>الإيجار الاختياري في حال العقار فرعي</option>
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              الاسم
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="اسم العقار..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              العنوان
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="عنوان العقار..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>

        {/* تم نقل (المكتب + العمولة) إلى قسم "المؤجر" */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المنطقة</label>
            <select
              value={formData.region}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  region: e.target.value,
                  city: "",
                  neighborhood: "",
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر</option>
              {SA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المدينة</label>
            <select
              value={formData.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  city: e.target.value,
                  neighborhood: "",
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              disabled={!formData.region}
            >
              <option value="">اختر</option>
              {cityOptions.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الحي</label>
            <input
              list="sa-neighborhoods-add"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              placeholder={formData.city ? "اختر أو اكتب اسم الحي" : "اختر المدينة أولاً"}
              disabled={!formData.city}
            />
            <datalist id="sa-neighborhoods-add">
              {neighborhoodOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Step-based structure: like screenshot (units + contract) then details */}
        <div className="rounded-xl border border-gray-200 bg-white/70 p-4 dark:border-emerald-800/40 dark:bg-[#102318]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">الوحدات والعقد</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                حدّد عدد كل نوع من الوحدات، ثم انتقل لإضافة تفاصيل كل وحدة (المساحة، الغرف، الصور... إلخ).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                ١/١
              </span>
            </div>
          </div>

          <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">عدد الشقق</label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    placeholder="مثال: 5"
                    value={formData.apartmentsCount}
                    onChange={(e) => setFormData({ ...formData, apartmentsCount: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">عدد المحلات</label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    placeholder="مثال: 2"
                    value={formData.shopsCount}
                    onChange={(e) => setFormData({ ...formData, shopsCount: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">أرقام الوحدات / النطاق</label>
                <input
                  type="text"
                  placeholder="مثال: 101-124 أو A1, A2, B1"
                  value={formData.unitIdentifiers}
                  onChange={(e) => setFormData({ ...formData, unitIdentifiers: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">إجمالي الوحدات: {totalUnitsFromCounts}</p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع / الاستحقاق *</label>
                  <select
                    value={formData.contractDuration}
                    onChange={(e) => setFormData({ ...formData, contractDuration: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  >
                    <option value="شهري">شهري</option>
                    <option value="نصف سنوي">نصف سنوي</option>
                    <option value="ربع سنوي">ربع سنوي</option>
                    <option value="سنوي">سنوي</option>
                  </select>
                </div>
              </div>

              {structureError ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">{structureError}</p>
                </div>
              ) : null}

              <div className="mt-5 text-xs text-gray-500 dark:text-gray-400">
                سيتم توليد الوحدات تلقائياً بعد حفظ تفاصيل العقار، وستكمل تفاصيل كل وحدة في صفحة مستقلة.
              </div>
          </>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">العنوان التفصيلي</label>
          <textarea
            placeholder="شارع/معلومة إضافية عن العنوان…"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">وصف العقار</label>
            <button
              type="button"
              onClick={() => void generateNotes()}
              disabled={genLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800/40 dark:bg-indigo-900/20 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
              title="توليد وصف تلقائي"
            >
              <Sparkles className="h-4 w-4" />
              {genLoading ? "جاري التوليد…" : "توليد وصف"}
            </button>
          </div>
          <textarea
            placeholder="اكتب وصف العقار…"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
          {genError ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{genError}</div> : null}
        </div>
        {userType !== "agency" ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-emerald-800/40 dark:bg-[#0f1e14]">
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">المؤجر</p>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="radio"
                  name="add-lessor-type"
                  checked={formData.lessorType === "owner"}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      lessorType: "owner",
                      managingOfficeId: "",
                      commissionPercent: "",
                    })
                  }
                  className="text-indigo-600"
                />
                مالك
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="radio"
                  name="add-lessor-type"
                  checked={formData.lessorType === "office"}
                  onChange={() => setFormData({ ...formData, lessorType: "office" })}
                  className="text-indigo-600"
                />
                مكتب
              </label>
            </div>
            {formData.lessorType === "office" ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">اختر المكتب</label>
                  <select
                    value={formData.managingOfficeId}
                    onChange={(e) => setFormData({ ...formData, managingOfficeId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  >
                    <option value="">—</option>
                    {agencyOffices.map((o) => (
                      <option key={o.officeId} value={o.officeId}>
                        {o.officeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نسبة العمولة (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="مثال: 5"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    سيتم احتسابها تلقائياً كمصروف عند تسجيل الإيراد لهذا العقار.
                  </p>
                </div>
                {agencyOffices.length === 0 ? (
                  <p className="sm:col-span-2 mt-1 text-xs text-amber-700 dark:text-amber-400">
                    لا توجد مكاتب مضافة بعد. أضف مكتباً من صفحة{" "}
                    <Link href="/dashboard/agencies" className="font-medium underline">
                      المكاتب
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب الكهرباء</label>
            <input
              type="text"
              placeholder="0"
              value={formData.electricityAccount || ""}
              onChange={(e) => setFormData({ ...formData, electricityAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب المياه</label>
            <input
              type="text"
              placeholder="0"
              value={formData.waterAccount || ""}
              onChange={(e) => setFormData({ ...formData, waterAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">مساحة العقار</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              />
              <span className="flex items-center text-sm text-gray-500">م²</span>
            </div>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">قيمة تكلفة العقار</label>
            <input
              type="number"
              placeholder="300,000"
              value={formData.propertyCost || ""}
              onChange={(e) => setFormData({ ...formData, propertyCost: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition hover:border-indigo-400 dark:border-emerald-800/50">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {pendingImages.length > 0 ? `${pendingImages.length} صورة محددة` : "إرفع صور العقار"}
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setPendingImages(Array.from(e.target.files ?? []))}
          />
        </label>
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingImages.map((f, i) => (
              <div key={i} className="relative h-16 w-16">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full rounded-lg object-cover" />
                <button type="button" onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            الغاء
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            إنشاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// EDIT PROPERTY MODAL
// ============================================================================

function EditPropertyModal({ isOpen, onClose, property }: { isOpen: boolean; onClose: () => void; property: DbProperty }) {
  const [agencyOffices, setAgencyOffices] = useState<{ officeId: string; officeName: string }[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: property.name,
    region: (property as any).region ?? "",
    city: property.city ?? "",
    neighborhood: property.neighborhood ?? "",
    address: property.address ?? "",
    latitude: (property as any).latitude != null ? String((property as any).latitude) : "",
    longitude: (property as any).longitude != null ? String((property as any).longitude) : "",
    title: property.title ?? property.name,
    lessorType: ((property as any).lessor_type === "office" ? "office" : "owner") as "owner" | "office",
    managingOfficeId: String((property as any).managing_office_id ?? ""),
    paymentFrequency: String((property as any).payment_frequency ?? "شهري"),
    commissionPercent:
      (property as any).commission_percent != null && (property as any).commission_percent !== ""
        ? String((property as any).commission_percent)
        : "",
    area: property.area_m2 ? String(property.area_m2) : "",
    annualRent: "",
    rentWithAddition: "",
    startDate: "",
    endDate: "",
    monthsCount: "12",
    includeFees: false,
    contractTerms: "الشروط الافتراضية",
    notes: "",
    electricityAccount: (property as any).electricity_account ?? "",
    waterAccount: (property as any).water_account ?? "",
    propertyCost: property.property_cost ? String(property.property_cost) : "",
  });

  const cityOptions = React.useMemo(() => citiesForRegion(formData.region), [formData.region]);
  const neighborhoodOptions = React.useMemo(() => neighborhoodsForCity(formData.city), [formData.city]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/owner/agencies");
        const data = res.ok ? await res.json() : [];
        const offices = Array.isArray(data)
          ? data.map((g: any) => ({ officeId: String(g.officeId), officeName: String(g.officeName ?? "—") }))
          : [];
        if (!cancelled) setAgencyOffices(offices);
      } catch {
        if (!cancelled) setAgencyOffices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      await authFetch(`/api/properties/${property.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || property.name,
          title: formData.title || null,
          region: formData.region || null,
          city: formData.city || null,
          neighborhood: formData.neighborhood || null,
          address: formData.address || null,
          latitude: formData.latitude.trim() ? Number(formData.latitude) : null,
          longitude: formData.longitude.trim() ? Number(formData.longitude) : null,
          area_m2: formData.area ? Number(formData.area) : property.area_m2,
          property_cost: formData.propertyCost ? Number(formData.propertyCost) : property.property_cost,
          water_account: formData.waterAccount?.trim() || null,
          electricity_account: formData.electricityAccount?.trim() || null,
          payment_frequency: formData.paymentFrequency?.trim() || null,
          lessor_type: formData.lessorType,
          lessor_contact_id: null,
          managing_office_id:
            formData.lessorType === "office" && formData.managingOfficeId?.trim() ? formData.managingOfficeId.trim() : null,
          commission_percent: formData.lessorType === "office" && formData.commissionPercent?.trim() ? Number(formData.commissionPercent) : null,
        }),
      });
      // Upload any new images
      for (const file of pendingImages) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("property_id", property.id);
        fd.append("image_type", "gallery");
        await authFetch("/api/property-images", { method: "POST", body: fd });
      }
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تعديل العقار" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              المجمع
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
              <option>الإيجار الاختياري في حال العقار فرعي</option>
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              الاسم
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="اسم العقار..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              العنوان
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="text"
              placeholder="عنوان العقار..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المنطقة</label>
            <select
              value={formData.region}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  region: e.target.value,
                  city: "",
                  neighborhood: "",
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر</option>
              {SA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المدينة</label>
            <select
              value={formData.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  city: e.target.value,
                  neighborhood: "",
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              disabled={!formData.region}
            >
              <option value="">اختر</option>
              {cityOptions.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الحي</label>
            <input
              list="sa-neighborhoods-edit"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              placeholder={formData.city ? "اختر أو اكتب اسم الحي" : "اختر المدينة أولاً"}
              disabled={!formData.city}
            />
            <datalist id="sa-neighborhoods-edit">
              {neighborhoodOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الوصف</label>
          <textarea
            placeholder="شارع فرعي"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">خط العرض (Latitude)</label>
            <input
              type="number"
              step="0.0000001"
              inputMode="decimal"
              placeholder="مثال: 24.7136"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">خط الطول (Longitude)</label>
            <input
              type="number"
              step="0.0000001"
              inputMode="decimal"
              placeholder="مثال: 46.6753"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الخريطة</label>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-emerald-800/30 dark:bg-[#0f1e14]">
              {(() => {
                const addressText = [formData.city, formData.neighborhood, formData.address].filter(Boolean).join("، ");
                const src = googleMapsEmbedSrc({ latitude: formData.latitude, longitude: formData.longitude, addressText });
                const link = googleMapsLink({ latitude: formData.latitude, longitude: formData.longitude, addressText });
                if (!src) {
                  return <div className="flex h-28 items-center justify-center text-xs text-gray-500 dark:text-gray-400">أدخل العنوان أو الإحداثيات لعرض الخريطة</div>;
                }
                return (
                  <div className="relative">
                    <iframe title="map" src={src} className="h-28 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-white dark:bg-[#1a3528]/90 dark:text-gray-200"
                      >
                        فتح في خرائط Google
                      </a>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-emerald-800/40 dark:bg-[#0f1e14]">
          <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">المؤجر وطريقة الدفع</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع / الاستحقاق</label>
              <select
                value={formData.paymentFrequency}
                onChange={(e) => setFormData({ ...formData, paymentFrequency: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              >
                <option value="شهري">شهري</option>
                <option value="نصف سنوي">نصف سنوي</option>
                <option value="ربع سنوي">ربع سنوي</option>
                <option value="سنوي">سنوي</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="radio"
                name="edit-lessor-type"
                checked={formData.lessorType === "owner"}
                onChange={() =>
                  setFormData({
                    ...formData,
                    lessorType: "owner",
                    managingOfficeId: "",
                    commissionPercent: "",
                  })
                }
                className="text-indigo-600"
              />
              مالك
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="radio"
                name="edit-lessor-type"
                checked={formData.lessorType === "office"}
                onChange={() => setFormData({ ...formData, lessorType: "office" })}
                className="text-indigo-600"
              />
              مكتب
            </label>
          </div>
          {formData.lessorType === "office" ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">اختر المكتب</label>
                <select
                  value={formData.managingOfficeId}
                  onChange={(e) => setFormData({ ...formData, managingOfficeId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="">—</option>
                  {agencyOffices.map((o) => (
                    <option key={o.officeId} value={o.officeId}>
                      {o.officeName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نسبة العمولة (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="مثال: 5"
                  value={formData.commissionPercent}
                  onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  سيتم احتسابها تلقائياً كمصروف عند تسجيل الإيراد لهذا العقار.
                </p>
              </div>
              {agencyOffices.length === 0 ? (
                <p className="sm:col-span-2 mt-1 text-xs text-amber-700 dark:text-amber-400">
                  لا توجد مكاتب مضافة بعد. أضف مكتباً من صفحة{" "}
                  <Link href="/dashboard/agencies" className="font-medium underline">
                    المكاتب
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب الكهرباء</label>
            <input
              type="text"
              placeholder="0"
              value={formData.electricityAccount || ""}
              onChange={(e) => setFormData({ ...formData, electricityAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم حساب المياه</label>
            <input
              type="text"
              placeholder="0"
              value={formData.waterAccount || ""}
              onChange={(e) => setFormData({ ...formData, waterAccount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">مساحة العقار</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="0"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              />
              <span className="flex items-center text-sm text-gray-500">م²</span>
            </div>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">قيمة تكلفة العقار</label>
            <input
              type="number"
              placeholder="300,000"
              value={formData.propertyCost || ""}
              onChange={(e) => setFormData({ ...formData, propertyCost: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition hover:border-indigo-400 dark:border-emerald-800/50">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {pendingImages.length > 0 ? `${pendingImages.length} صورة محددة` : "إضافة صور للعقار"}
          </p>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPendingImages(Array.from(e.target.files ?? []))} />
        </label>
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingImages.map((f, i) => (
              <div key={i} className="relative h-16 w-16">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full rounded-lg object-cover" />
                <button type="button" onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            الغاء
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            حفظ التغييرات
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, propertyName }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; propertyName: string }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تأكيد حذف" size="md">
      <div className="space-y-4">
        <p className="text-center text-gray-700 dark:text-gray-300">
          هل أنت متأكد من إلغاء العقد؟
        </p>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          لنرجو تحديد البيانات المطلوبة الغاءها:
        </p>
        <div className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-[#1a3528]">
          {[
            { id: "revenues", label: "الإيراد والسعي" },
            { id: "expenses", label: "العمولات الإضافية" },
            { id: "taxes", label: "تكاليف المياه" },
            { id: "electricity", label: "تكاليف الكهرباء" },
            { id: "insurance", label: "الخدمة السنوية" },
            { id: "other", label: "تكاليف أخرى" },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
              <button
                type="button"
                onClick={() => setConfirmed(!confirmed)}
                className={`relative h-6 w-11 rounded-full transition ${confirmed ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${confirmed ? "right-1" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            الغاء
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            تأكيد
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD CONTRACT MODAL
// ============================================================================

function localCalendarYmd(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AddContractModal({
  isOpen,
  onClose,
  propertyId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  onCreated: (c: {
    id: string;
    tenant: string;
    unitId: string | null;
    startDate: string;
    endDate: string;
    rent: number;
    status: string;
  }) => void;
}) {
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [unitOptions, setUnitOptions] = useState<Array<{ id: string; label: string; price_sar: number }>>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [paymentsEditable, setPaymentsEditable] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    property: "",
    propertyNumber: "",
    tenantName: "",
    tenantContactId: "",
    startDate: localCalendarYmd(),
    endDate: "",
    monthsCount: "12",
    periodicBilling: false,
    rent: "",
    includeFees: false,
    includeRentInFees: false,
    autoRenew: false,
    contractNumber: "",
    contractTerms: "الشروط الافتراضية",
    annualCommissionEnabled: false,
    annualCommissionValue: "",
    changeCommissionAfterPaid: false,
    annualService: "",
    extraCommission: "",
    waterCost: "",
    electricityCost: "",
    otherCosts: "",
    notes: "",
  });

  const [payments, setPayments] = useState<Array<{ id: string; note: string; amount: string; date: string }>>([]);

  const addMonthsYmd = (startYmd: string, months: number) => {
    const d = new Date(`${startYmd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return startYmd;
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const next = new Date(y, m + months, day);
    const yy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const [endDateManual, setEndDateManual] = useState(false);

  useEffect(() => {
    // auto-calc endDate + generate default payments based on monthsCount
    const months = Math.max(1, Math.min(240, Number(formData.monthsCount || 1)));
    if (!endDateManual) {
      const computedEnd = addMonthsYmd(formData.startDate, months);
      setFormData((p) => ({ ...p, endDate: computedEnd }));
    }

    const totalRent = Number(formData.rent || 0);
    const per = months > 0 ? Math.round((Number.isFinite(totalRent) ? totalRent : 0) / months) : 0;
    setPayments((prev) => {
      const keepUserEdits = paymentsEditable && prev.length > 0;
      if (keepUserEdits) return prev;
      return Array.from({ length: months }, (_, i) => ({
        id: `p_${i + 1}`,
        note: `دفعة الإيجار رقم: ${i + 1}`,
        amount: String(per || ""),
        date: addMonthsYmd(formData.startDate, i),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.monthsCount, formData.rent]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedUnitId("");
    setPaymentsEditable(false);
    setEndDateManual(false);
    setContractError(null);
    const today = localCalendarYmd();
    setFormData((p) => ({
      ...p,
      tenantName: "",
      tenantContactId: "",
      startDate: today,
      endDate: "",
      monthsCount: "12",
      rent: "",
      contractNumber: "",
      notes: "",
    }));
    void (async () => {
      const [contactsRes, unitsRes] = await Promise.all([
        fetch("/api/contacts"),
        fetch(`/api/units?property_id=${propertyId}`),
      ]);
      const [contacts, units] = await Promise.all([
        contactsRes.ok ? contactsRes.json() : [],
        unitsRes.ok ? unitsRes.json() : [],
      ]);
      setTenantOptions((contacts ?? []).map((c: any) => ({
        id: String(c.id),
        name: String(c.name),
        type: String(c.type),
      })));
      setUnitOptions((units ?? []).map((u: any) => ({
        id: String(u.id),
        label: String(u.label ?? "وحدة"),
        price_sar: Number(u.rent_amount) || 0,
      })));
    })();
  }, [isOpen, propertyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContractError(null);
    if (!formData.startDate || !formData.endDate) return;
    if (!formData.tenantContactId) {
      setContractError("يرجى اختيار المستأجر.");
      return;
    }
    const rent = Number(formData.rent) || 0;
    if (rent <= 0) {
      setContractError("يرجى إدخال مبلغ العقد (أكبر من 0) أو اختر وحدة بسعر محدد.");
      return;
    }
    void (async () => {
      const contactId = formData.tenantContactId;

      const paymentRows = (payments ?? [])
        .filter((p) => p && p.date && Number(p.amount) > 0)
        .map((p) => ({
          due_date: String(p.date),
          amount_sar: Number(p.amount) || 0,
          status: "pending" as const,
          notes: p.note || null,
        }));

      const contractRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          unit_id: selectedUnitId || null,
          contact_id: contactId,
          status: "active",
          start_date: formData.startDate,
          end_date: formData.endDate,
          rent_total_sar: rent,
          extra: {
            annualCommissionEnabled: formData.annualCommissionEnabled,
            annualCommissionValue: formData.annualCommissionValue,
            changeCommissionAfterPaid: formData.changeCommissionAfterPaid,
            annualService: formData.annualService,
            extraCommission: formData.extraCommission,
            waterCost: formData.waterCost,
            electricityCost: formData.electricityCost,
            otherCosts: formData.otherCosts,
            payments,
          },
          payments: paymentRows,
        }),
      });

      if (!contractRes.ok) return;
      const inserted = await contractRes.json();
      if (!inserted?.id) return;

      const tenantLabel =
        tenantOptions.find((t) => t.id === formData.tenantContactId)?.name?.trim() || formData.tenantName.trim() || "—";
      onCreated({
        id: String(inserted.id),
        tenant: tenantLabel,
        unitId: selectedUnitId || null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        rent,
        status: "ساري",
      });
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة عقد جديد" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {contractError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {contractError}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الوحدة</label>
            <select
              value={selectedUnitId}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                // Auto-fill rent from unit price if available
                const unit = unitOptions.find((u) => u.id === e.target.value);
                if (unit && unit.price_sar > 0) {
                  setFormData((p) => ({ ...p, rent: String(unit.price_sar) }));
                }
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">— اختر الوحدة (اختياري) —</option>
              {unitOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}{u.price_sar > 0 ? ` — ${u.price_sar.toLocaleString()} ر.س` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">اسم المستأجر</label>
            <select
              value={formData.tenantContactId}
              onChange={(e) => {
                const id = e.target.value;
                const t = tenantOptions.find((o) => o.id === id);
                setFormData((p) => ({ ...p, tenantContactId: id, tenantName: t?.name ?? "" }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">— اختر المستأجر —</option>
              {(tenantOptions.some((t) => t.type === "tenant")
                ? tenantOptions.filter((t) => t.type === "tenant")
                : tenantOptions
              ).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={() => window.open("/dashboard/contacts", "_blank", "noopener,noreferrer")}
              className="mt-6 flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              إضافة مستأجر جديد
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">بداية العقد</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نهاية العقد</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => {
                setEndDateManual(true);
                const v = e.target.value;
                setFormData((p) => ({ ...p, endDate: v }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">عدد الأشهر</label>
            <input
              type="number"
              value={formData.monthsCount}
              onChange={(e) => {
                setEndDateManual(false);
                setFormData((p) => ({ ...p, monthsCount: e.target.value }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-300 p-3 dark:border-emerald-800/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">التقويم الميلادي</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, periodicBilling: !formData.periodicBilling })}
              className={`relative h-6 w-11 rounded-full transition ${formData.periodicBilling ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.periodicBilling ? "right-1" : "left-1"}`} />
            </button>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              إجمالي الإيجار
              <Info className="h-4 w-4 text-indigo-600" />
            </label>
            <input
              type="number"
              value={formData.rent}
              onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-300 p-3 dark:border-emerald-800/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">شامل ضريبة القيمة المضافة</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, includeFees: !formData.includeFees })}
              className={`relative h-6 w-11 rounded-full transition ${formData.includeFees ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.includeFees ? "right-1" : "left-1"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-300 p-3 dark:border-emerald-800/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">إجمالي الإيجار شامل ضريبة القيمة المضافة</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, includeRentInFees: !formData.includeRentInFees })}
              className={`relative h-6 w-11 rounded-full transition ${formData.includeRentInFees ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.includeRentInFees ? "right-1" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-300 p-3 dark:border-emerald-800/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">فترة الدفع</span>
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
              <option>الإيجار الاختياري</option>
            </select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-300 p-3 dark:border-emerald-800/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">تجديد العقد تلقائياً</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, autoRenew: !formData.autoRenew })}
              className={`relative h-6 w-11 rounded-full transition ${formData.autoRenew ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.autoRenew ? "right-1" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">رقم العقد</label>
            <input
              type="text"
              placeholder="رقم العقد"
              value={formData.contractNumber}
              onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">شروط وأحكام العقد</label>
            <select
              value={formData.contractTerms}
              onChange={(e) => setFormData({ ...formData, contractTerms: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option>الشروط الافتراضية</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات إضافية</label>
          <textarea
            placeholder="ملاحظات إضافية"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>

        {/* Extra Fields */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-emerald-800/30 dark:bg-[#102318]">
          <button
            type="button"
            onClick={() => setShowExtraFields((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
          >
            <span>حقول إضافية</span>
            <span className="text-gray-500 dark:text-gray-400">{showExtraFields ? "▲" : "▼"}</span>
          </button>

          {showExtraFields ? (
            <div className="mt-4 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">عمولات مدير الأملاك</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-emerald-800/30 dark:bg-[#1a3528]">
                    <span className="text-sm text-gray-700 dark:text-gray-200">السعي السنوي</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, annualCommissionEnabled: !formData.annualCommissionEnabled })}
                      className={`relative h-6 w-11 rounded-full transition ${formData.annualCommissionEnabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.annualCommissionEnabled ? "right-1" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">قيمة</label>
                    <input
                      type="number"
                      value={formData.annualCommissionValue}
                      onChange={(e) => setFormData({ ...formData, annualCommissionValue: e.target.value })}
                      placeholder="قيمة"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                      disabled={!formData.annualCommissionEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-emerald-800/30 dark:bg-[#1a3528] md:col-span-2">
                    <span className="text-sm text-gray-700 dark:text-gray-200">تغيير حالة السعي بعد دفع الإيجار</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, changeCommissionAfterPaid: !formData.changeCommissionAfterPaid })}
                      className={`relative h-6 w-11 rounded-full transition ${formData.changeCommissionAfterPaid ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${formData.changeCommissionAfterPaid ? "right-1" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الخدمة السنوية</label>
                    <input
                      type="number"
                      value={formData.annualService}
                      onChange={(e) => setFormData({ ...formData, annualService: e.target.value })}
                      placeholder="الخدمة السنوية"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">عمولة إضافية</label>
                    <input
                      type="number"
                      value={formData.extraCommission}
                      onChange={(e) => setFormData({ ...formData, extraCommission: e.target.value })}
                      placeholder="عمولة إضافية"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">معلومات إيجارية أخرى</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">تكاليف خدمة المياه</label>
                    <input
                      type="number"
                      value={formData.waterCost}
                      onChange={(e) => setFormData({ ...formData, waterCost: e.target.value })}
                      placeholder="تكاليف خدمة المياه"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">تكاليف خدمة الكهرباء</label>
                    <input
                      type="number"
                      value={formData.electricityCost}
                      onChange={(e) => setFormData({ ...formData, electricityCost: e.target.value })}
                      placeholder="تكاليف خدمة الكهرباء"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">تكاليف أخرى</label>
                    <input
                      type="number"
                      value={formData.otherCosts}
                      onChange={(e) => setFormData({ ...formData, otherCosts: e.target.value })}
                      placeholder="تكاليف أخرى"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">ملحقات</p>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="شروط إضافية"
                  className="h-28 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Payments */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-emerald-800/30 dark:bg-[#132a1f]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">المدفوعات</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaymentsEditable((v) => !v)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-200"
              >
                {paymentsEditable ? "تم" : "تعديل"}
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                نهاية العقد (الفعلي):
                <span className="mr-2 font-semibold text-gray-900 dark:text-white">{formData.endDate || "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">ملاحظات</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium">تاريخ الدفعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {payments.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <input
                        value={p.note}
                        onChange={(e) =>
                          setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, note: e.target.value } : x)))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800/30 dark:bg-[#102318] dark:text-white"
                        disabled={!paymentsEditable}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={p.amount}
                        onChange={(e) =>
                          setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, amount: e.target.value } : x)))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800/30 dark:bg-[#102318] dark:text-white"
                        disabled={!paymentsEditable}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={p.date}
                        onChange={(e) =>
                          setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, date: e.target.value } : x)))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800/30 dark:bg-[#102318] dark:text-white"
                        disabled={!paymentsEditable}
                      />
                    </td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      لا توجد دفعات.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            الغاء
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            معاينة العقد
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// ADD REVENUE MODAL
// ============================================================================

function AddRevenueModal({ isOpen, onClose, propertyId, onSuccess }: { isOpen: boolean; onClose: () => void; propertyId: string; onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "إيجار",
    paymentMethod: "حوالة",
    contact_id: "",
    notes: "",
  });
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/contacts").then((r) => r.ok ? r.json() : []).then(setContacts).catch(() => {});
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;
    void (async () => {
      await fetch("/api/revenues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          type: formData.type,
          amount_sar: Number(formData.amount) || 0,
          received_at: formData.date ? new Date(formData.date).toISOString() : null,
          description: [formData.notes, formData.paymentMethod].filter(Boolean).join(" - ") || null,
        }),
      });
      onSuccess?.();
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة إيراد جديد" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ (ر.س) *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الاستلام *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نوع الإيراد</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="إيجار">إيجار</option>
              <option value="تأمين">تأمين</option>
              <option value="صيانة">صيانة</option>
              <option value="عمولة">عمولة</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="حوالة">حوالة بنكية</option>
              <option value="نقدي">نقدي</option>
              <option value="بطاقة">بطاقة</option>
              <option value="شيك">شيك</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">جهة الاتصال</label>
          <select
            value={formData.contact_id}
            onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="">— اختياري —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</label>
          <textarea
            placeholder="ملاحظة عن الإيراد..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">الغاء</button>
          <button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">إضافة</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// ADD EXPENSE MODAL
// ============================================================================

function AddExpenseModal({ isOpen, onClose, propertyId, onSuccess }: { isOpen: boolean; onClose: () => void; propertyId: string; onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "صيانة",
    paymentMethod: "حوالة",
    contact_id: "",
    notes: "",
  });
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/contacts").then((r) => r.ok ? r.json() : []).then(setContacts).catch(() => {});
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;
    void (async () => {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          type: formData.type,
          amount_sar: Number(formData.amount) || 0,
          paid_at: formData.date ? new Date(formData.date).toISOString() : null,
          description: formData.notes || null,
        }),
      });
      onSuccess?.();
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مصروف جديد" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ (ر.س) *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الدفع *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نوع المصروف</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="صيانة">صيانة</option>
              <option value="مياه">مياه</option>
              <option value="كهرباء">كهرباء</option>
              <option value="تأمين">تأمين</option>
              <option value="نظافة">نظافة</option>
              <option value="إدارة">رسوم إدارة</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="حوالة">حوالة بنكية</option>
              <option value="نقدي">نقدي</option>
              <option value="بطاقة">بطاقة</option>
              <option value="شيك">شيك</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">جهة الاتصال</label>
          <select
            value={formData.contact_id}
            onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="">— اختياري —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</label>
          <textarea
            placeholder="ملاحظة عن المصروف..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">الغاء</button>
          <button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">إضافة</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// ADD INSTALLMENT MODAL
// ============================================================================

function AddInstallmentModal({
  isOpen,
  onClose,
  contractId,
  propertyId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  contractId: string | null;
  propertyId: string;
  onSuccess?: () => void;
}) {
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "إيجار",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId) return;
    if (!formData.amount || Number(formData.amount) <= 0) return;
    if (!formData.date) return;
    void (async () => {
      await fetch("/api/contract-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          due_date: formData.date,
          amount_sar: Number(formData.amount) || 0,
          status: "pending",
          notes: formData.notes || null,
        }),
      });
      onSuccess?.();
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة دفعة جديدة" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الدفع</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نوع الدفعة</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="إيجار">إيجار</option>
            <option value="تأمين">تأمين</option>
            <option value="صيانة">صيانة</option>
            <option value="أخرى">أخرى</option>
          </select>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظة</label>
          <textarea
            placeholder="كتابة ملاحظة عن الدفعة"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">الغاء</button>
          <button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700">إضافة</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// ADD INSURANCE MODAL
// ============================================================================

function AddInsuranceModal({ isOpen, onClose, propertyId, onSuccess }: { isOpen: boolean; onClose: () => void; propertyId?: string; onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "تأمين",
    contact_id: "",
    repeatInterval: "لا تكرار",
    notes: "",
  });
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/contacts").then((r) => r.ok ? r.json() : []).then(setContacts).catch(() => {});
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;
    setSaving(true);
    void (async () => {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId || null,
          type: formData.type,
          amount_sar: Number(formData.amount) || 0,
          paid_at: new Date(formData.date).toISOString(),
          description: formData.notes || null,
        }),
      });
      setSaving(false);
      onSuccess?.();
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة فاتورة / تأمين" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ (ر.س) *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الدفع *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نوع الفاتورة</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="تأمين">تأمين</option>
              <option value="صيانة">صيانة</option>
              <option value="مياه">مياه</option>
              <option value="كهرباء">كهرباء</option>
              <option value="نظافة">نظافة</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">تكرار</label>
            <select
              value={formData.repeatInterval}
              onChange={(e) => setFormData({ ...formData, repeatInterval: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="لا تكرار">لا تكرار</option>
              <option value="شهري">شهري</option>
              <option value="ربع سنوي">ربع سنوي</option>
              <option value="سنوي">سنوي</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">جهة الاتصال</label>
          <select
            value={formData.contact_id}
            onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="">— اختياري —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظة</label>
          <textarea
            placeholder="ملاحظة..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">الغاء</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">{saving ? "جارٍ الحفظ..." : "إضافة"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// OFFER PRICE MODAL
// ============================================================================

function OfferPriceModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    property_id: "",
    unit_id: "",
    contact_id: "",
    startDate: new Date().toISOString().split("T")[0],
    monthsCount: "12",
    rent: "",
    paymentPeriod: "سنوي",
    notes: "",
  });
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; label: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      fetch("/api/properties").then((r) => r.ok ? r.json() : []),
      fetch("/api/contacts").then((r) => r.ok ? r.json() : []),
    ]).then(([props, cons]) => {
      setProperties(props ?? []);
      setContacts(cons ?? []);
    }).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!formData.property_id) { setUnits([]); return; }
    fetch(`/api/units?property_id=${formData.property_id}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setUnits)
      .catch(() => {});
  }, [formData.property_id]);

  const endDate = React.useMemo(() => {
    if (!formData.startDate || !formData.monthsCount) return "";
    const d = new Date(formData.startDate);
    d.setMonth(d.getMonth() + Number(formData.monthsCount));
    return d.toISOString().split("T")[0];
  }, [formData.startDate, formData.monthsCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id || !formData.contact_id || !formData.rent) return;
    setSaving(true);
    void (async () => {
      await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: formData.property_id,
          unit_id: formData.unit_id || null,
          contact_id: formData.contact_id,
          start_date: formData.startDate,
          end_date: endDate,
          rent_amount: Number(formData.rent) || 0,
          payment_period: formData.paymentPeriod,
          notes: formData.notes || null,
          status: "active",
        }),
      });
      setSaving(false);
      onSuccess?.();
      onClose();
    })();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء عقد إيجار" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">العقار *</label>
            <select
              required
              value={formData.property_id}
              onChange={(e) => setFormData({ ...formData, property_id: e.target.value, unit_id: "" })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="">اختر العقار</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">الوحدة</label>
            <select
              value={formData.unit_id}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
              disabled={!formData.property_id}
            >
              <option value="">— كامل العقار —</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">المستأجر *</label>
          <select
            required
            value={formData.contact_id}
            onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          >
            <option value="">اختر المستأجر</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">بداية العقد *</label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">مدة العقد (أشهر)</label>
            <input
              type="number"
              min="1"
              value={formData.monthsCount}
              onChange={(e) => setFormData({ ...formData, monthsCount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">نهاية العقد</label>
            <input
              type="text"
              readOnly
              value={endDate}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right text-sm dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-gray-400"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">قيمة الإيجار (ر.س) *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.rent}
              onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">دورة الدفع</label>
            <select
              value={formData.paymentPeriod}
              onChange={(e) => setFormData({ ...formData, paymentPeriod: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
            >
              <option value="شهري">شهري</option>
              <option value="ربع سنوي">ربع سنوي</option>
              <option value="نصف سنوي">نصف سنوي</option>
              <option value="سنوي">سنوي</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</label>
          <textarea
            placeholder="ملاحظات إضافية..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">الغاء</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">{saving ? "جارٍ الإنشاء..." : "إنشاء العقد"}</button>
        </div>
      </form>
    </Modal>
  );
}

type PropertyContractPreview =
  | { tenantName: string; tenantPhone: string | null; unitLabel: string; startDate: string; endDate: string }
  | ({ summary: OwnerContractSummary } & { unitLabel: string });

export function PropertiesContent() {
  const { canMutate, canMutateProperties, ownerHidesTenantPii, canManageContracts, userType: meUserType } =
    useCanMutate();
  const userType: "owner" | "agency" | "personal" =
    meUserType === "agency" ? "agency" : meUserType === "personal" ? "personal" : "owner";
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [currentContractByProperty, setCurrentContractByProperty] = useState<Record<string, PropertyContractPreview>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const refreshTick = useRealtimeRefresh();

  // Modal states
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [showAddComplex, setShowAddComplex] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string>("");

  const loadProperties = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/properties");
      if (!res.ok) {
        setProperties([]);
        setCurrentContractByProperty({});
        return;
      }
      const data = await res.json();
      setProperties((data ?? []) as DbProperty[]);

      const nextMap: Record<string, PropertyContractPreview> = {};
      for (const prop of data ?? []) {
        if (prop.active_contract) {
          const ac = prop.active_contract;
          if (ac.days_until_contract_end !== undefined || ac.days_until_next_rent_due !== undefined) {
            nextMap[String(prop.id)] = {
              summary: ac as OwnerContractSummary,
              unitLabel: String(ac.unit_label ?? "—"),
            };
          } else {
            nextMap[String(prop.id)] = {
              tenantName: String(ac.contact_name ?? "—"),
              tenantPhone: ac.contact_phone ?? null,
              unitLabel: String(ac.unit_label ?? "—"),
              startDate: String(ac.start_date ?? "—"),
              endDate: String(ac.end_date ?? "—"),
            };
          }
        }
      }
      setCurrentContractByProperty(nextMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadProperties();
  }, [loadProperties, refreshTick]);

  const filteredProperties = properties.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const contract = currentContractByProperty[String(p.id)];
    const hay = [
      p.name,
      p.title ?? "",
      p.city ?? "",
      p.neighborhood ?? "",
      p.address ?? "",
      p.region ?? "",
      "summary" in (contract ?? {}) ? "" : (contract as { tenantName?: string })?.tenantName ?? "",
      "summary" in (contract ?? {}) ? "" : (contract as { tenantPhone?: string })?.tenantPhone ?? "",
      contract?.unitLabel ?? "",
      p.property_model_type ?? "",
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const activeProperties = filteredProperties.filter((p) => p.status === "active");
  const vacantProperties = filteredProperties.filter((p) => p.status === "vacant");
  const displayedProperties =
    activeTab === "active" ? activeProperties : activeTab === "vacant" ? vacantProperties : filteredProperties;

  const handleAddPropertyChoice = (type: "single" | "complex") => {
    setShowAddChoice(false);
    if (type === "single") {
      setShowAddProperty(true);
    } else {
      setShowAddComplex(true);
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    setPropertyToDelete(propertyId);
    setShowDeleteConfirm(true);
  };

  if (selectedProperty) {
    return (
      <>
        <PropertyDetail
          property={selectedProperty}
          onBack={() => setSelectedPropertyId(null)}
          canMutate={canMutate}
          canMutateProperties={canMutateProperties}
          canManageContracts={canManageContracts}
          ownerHidesTenantPii={ownerHidesTenantPii}
          userType={userType}
          onDelete={canMutateProperties ? () => handleDeleteProperty(selectedProperty.id) : undefined}
        />
        <DeleteConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            const res = await fetch(`/api/properties/${propertyToDelete}`, { method: "DELETE" });
            setShowDeleteConfirm(false);
            if (res.ok) {
              setSelectedPropertyId(null);
              await loadProperties();
            }
          }}
          propertyName={selectedProperty.name}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">العقارات</h1>
          <span
            className="rounded-lg bg-primary/10 px-2 py-1 text-sm font-medium text-primary"
            suppressHydrationWarning
          >
            {mounted ? filteredProperties.length : 0}
          </span>
        </div>
        {canMutateProperties ? (
          <button
            onClick={() => setShowAddChoice(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            إضافة عقار
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث باسم العقار أو الموقع أو النوع"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-10 text-right text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300">
          <Filter className="h-4 w-4" />
          تصفية
        </button>
        <div className="flex rounded-lg border border-gray-300 bg-white dark:border-emerald-800/50 dark:bg-[#1a3528]">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex h-10 w-10 items-center justify-center ${
              viewMode === "grid" ? "bg-primary text-white" : "text-gray-600 dark:text-gray-400"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex h-10 w-10 items-center justify-center ${
              viewMode === "list" ? "bg-primary text-white" : "text-gray-600 dark:text-gray-400"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-emerald-800/30">
        {[
          { id: "all", label: "الكل", count: filteredProperties.length },
          { id: "active", label: "محجوزة", count: activeProperties.length },
          { id: "vacant", label: "شاغرة", count: vacantProperties.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.id
                ? "text-primary"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            <span className="mr-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-[#1a3528]">
              {tab.count}
            </span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Properties Grid */}
      <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "space-y-3"}>
        {displayedProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onClick={() => setSelectedPropertyId(property.id)}
            viewMode={viewMode}
            currentContract={currentContractByProperty[property.id] ?? null}
            ownerHidesTenantPii={ownerHidesTenantPii}
          />
        ))}
      </div>

      {/* Empty State */}
      {displayedProperties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-16 w-16 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {loading ? "جاري تحميل العقارات..." : "لا توجد عقارات"}
          </p>
        </div>
      )}

      {/* Modals */}
      <AddPropertyChoiceModal
        isOpen={showAddChoice}
        onClose={() => setShowAddChoice(false)}
        onSelect={handleAddPropertyChoice}
      />
      <AddComplexModal
        isOpen={showAddComplex}
        onClose={() => setShowAddComplex(false)}
      />
      <AddPropertyModal
        isOpen={showAddProperty}
        onClose={() => {
          setShowAddProperty(false);
          void loadProperties();
        }}
        userType={userType}
      />
    </div>
  );
}

function PropertyCard({
  property,
  onClick,
  viewMode,
  currentContract,
  ownerHidesTenantPii,
}: {
  property: DbProperty;
  onClick: () => void;
  viewMode: "grid" | "list";
  currentContract?: PropertyContractPreview | null;
  ownerHidesTenantPii: boolean;
}) {
  const contractLabel = React.useMemo(() => {
    if (!currentContract) return "—";
    if ("summary" in currentContract) {
      const s = currentContract.summary;
      const end = formatDaysUntilAr(s.days_until_contract_end);
      const rent = formatDaysUntilAr(s.days_until_next_rent_due);
      return `${end} · ${rent}`;
    }
    return currentContract.tenantName && currentContract.tenantName !== "—"
      ? currentContract.tenantName
      : "—";
  }, [currentContract]);
  const location = [property.city, property.neighborhood, property.address].filter(Boolean).join("، ") || "—";

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="flex cursor-pointer items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-emerald-600/20 to-indigo-600/20">
          {property.cover_url && (
            <img src={property.cover_url} alt={property.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">{property.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                property.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : property.status === "vacant"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {property.status === "active" ? "مؤجرة" : property.status === "vacant" ? "شاغرة" : "منتهية"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{location}</p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {property.units_count} وحدات
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {ownerHidesTenantPii
                ? `العقد: ${contractLabel}`
                : currentContract && "tenantName" in currentContract && currentContract.tenantName !== "—"
                  ? `العقد الحالي: ${currentContract.tenantName}`
                  : "العقد الحالي: —"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]"
    >
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-emerald-600/15 via-transparent to-indigo-600/20">
        {property.cover_url && (
          <img src={property.cover_url} alt={property.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute left-2 top-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              property.status === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : property.status === "vacant"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {property.status === "active" ? "مؤجرة" : property.status === "vacant" ? "شاغرة" : "منتهية"}
          </span>
        </div>
        <div className="absolute bottom-2 right-2">
          <span className="rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
            {property.property_model_type || "—"}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{property.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{location}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Home className="h-4 w-4" />
            <span>{property.units_count} وحدات</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Users className="h-4 w-4" />
            <span className="truncate text-xs">{contractLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function unitComponentTypeLabel(type: string) {
  const map: Record<string, string> = {
    living_room: "صالون",
    bedroom: "غرفة نوم",
    kitchen: "مطبخ",
    bathroom: "حمام",
    balcony: "بلكونة",
    office: "مكتب",
    storage: "مستودع",
    maid_room: "غرفة خادمة",
  };
  return map[type] ?? type;
}

function PropertyDetail({
  property,
  onBack,
  onDelete,
  canMutate,
  canMutateProperties,
  canManageContracts,
  ownerHidesTenantPii,
  userType,
}: {
  property: DbProperty;
  onBack: () => void;
  onDelete?: () => void;
  canMutate: boolean;
  canMutateProperties: boolean;
  canManageContracts: boolean;
  ownerHidesTenantPii: boolean;
  userType: "owner" | "agency" | "personal";
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("info");
  const [selectedContractSummary, setSelectedContractSummary] = useState<OwnerContractSummary | null>(null);
  const [currentContractSummary, setCurrentContractSummary] = useState<OwnerContractSummary | null>(null);
  const [commissionTotals, setCommissionTotals] = useState<{ totalCommissionSar: number; monthCommissionSar: number; yearCommissionSar: number } | null>(null);
  const [contractHistory, setContractHistory] = useState<
    Array<{
      id: string;
      tenant: string;
      summary?: OwnerContractSummary | null;
      unitId: string | null;
      unitLabel: string;
      startDate: string;
      endDate: string;
      rent: number;
      status: string;
    }>
  >([]);
  const [selectedContract, setSelectedContract] = useState<{
    id: string;
    tenant: string;
    summary?: OwnerContractSummary | null;
    unitId: string | null;
    unitLabel: string;
    startDate: string;
    endDate: string;
    rent: number;
    status: string;
  } | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  const [editContractForm, setEditContractForm] = useState<{
    unitId: string | null;
    startDate: string;
    endDate: string;
    rent: string;
    status: "active" | "ended" | "cancelled";
    tenantName: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedContractPayments, setSelectedContractPayments] = useState<
    Array<{ id: string; due_date: string; amount_sar: number; status: string; paid_at: string | null }>
  >([]);
  const [canGeneratePayments, setCanGeneratePayments] = useState(false);
  const [generatingPayments, setGeneratingPayments] = useState(false);
  const [currentTenantName, setCurrentTenantName] = useState<string>("—");
  const [currentTenantPhone, setCurrentTenantPhone] = useState<string>("—");
  const [currentContractStart, setCurrentContractStart] = useState<string>("—");
  const [currentContractEnd, setCurrentContractEnd] = useState<string>("—");
  const [occupancyRate, setOccupancyRate] = useState<number>(0);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [unitsTotalRent, setUnitsTotalRent] = useState<number | null>(null);
  const [propertyUnits, setPropertyUnits] = useState<Array<{
    id: string;
    label: string;
    unit_type?: string | null;
    price_sar: number;
    sort_order: number;
    status?: string | null;
    area_sqm?: number | null;
    description?: string | null;
    floor?: string | null;
    components: Array<{ id: string; type: string; label: string; sizeM2?: string; description?: string; images: Array<{ id: string; url?: string }> }>;
  }>>([]);
  const [unitContractMap, setUnitContractMap] = useState<
    Record<string, { status: string; tenantName: string; startDate: string; endDate: string; summary?: OwnerContractSummary | null }>
  >({});
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isEditingUnit, setIsEditingUnit] = useState(false);
  const [unitEditForm, setUnitEditForm] = useState({
    label: "",
    price_sar: "",
    status: "vacant",
    area_sqm: "",
    description: "",
    unit_type: "apartment",
    floor: "",
  });
  const [savingUnit, setSavingUnit] = useState(false);
  const selectedUnit = propertyUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const selectedUnitContract = selectedUnit ? unitContractMap[selectedUnit.id] ?? null : null;
  const selectedUnitImages = selectedUnit?.components.flatMap((component) => component.images ?? []).filter((image) => image.url) ?? [];
  const openUnitModal = React.useCallback((unitId: string) => {
    const unit = propertyUnits.find((u) => u.id === unitId);
    if (!unit) return;
    setUnitEditForm({
      label: unit.label,
      price_sar: unit.price_sar > 0 ? String(unit.price_sar) : "",
      status: unit.status === "occupied" || unit.status === "rented" ? "occupied" : unit.status === "vacant" ? "vacant" : unit.status || "vacant",
      area_sqm: unit.area_sqm != null ? String(unit.area_sqm) : "",
      description: unit.description ?? "",
      unit_type: unit.unit_type ?? "apartment",
      floor: unit.floor ?? "",
    });
    setIsEditingUnit(false);
    setSelectedUnitId(unitId);
  }, [propertyUnits]);
  const selectedUnitStats = selectedUnit
    ? {
        bedrooms: selectedUnit.components.filter((component) => component.type === "bedroom").length,
        bathrooms: selectedUnit.components.filter((component) => component.type === "bathroom").length,
        livingRooms: selectedUnit.components.filter((component) => component.type === "living_room").length,
        offices: selectedUnit.components.filter((component) => component.type === "office").length,
        hasKitchen: selectedUnit.components.some((component) => component.type === "kitchen"),
        hasBalcony: selectedUnit.components.some((component) => component.type === "balcony"),
      }
    : null;
  async function handleSaveUnit() {
    if (!selectedUnit || !canMutate) return;
    setSavingUnit(true);
    try {
      const body = {
        label: unitEditForm.label.trim(),
        rent_amount: unitEditForm.price_sar === "" ? null : Number(unitEditForm.price_sar),
        status: unitEditForm.status,
        area_sqm: unitEditForm.area_sqm === "" ? null : Number(unitEditForm.area_sqm),
        description: unitEditForm.description.trim() || null,
        unit_type: unitEditForm.unit_type || null,
        floor: unitEditForm.floor.trim() || null,
      };
      const res = await authFetch(`/api/units/${selectedUnit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "فشل حفظ الوحدة");
      }
      setIsEditingUnit(false);
      bumpRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setSavingUnit(false);
    }
  }
  const [currentActiveContractId, setCurrentActiveContractId] = useState<string | null>(null);
  const [nextPaymentDate, setNextPaymentDate] = useState<string>("—");
  const [nextPaymentAmount, setNextPaymentAmount] = useState<number | null>(null);
  const [uncollectedSar, setUncollectedSar] = useState<number>(0);
  const [collectionRatePercent, setCollectionRatePercent] = useState<number>(0);
  const [propertyImages, setPropertyImages] = useState<Array<{ id: string; public_url: string; image_type: string }>>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [showAddContract, setShowAddContract] = useState(false);
  const [showCancelContract, setShowCancelContract] = useState(false);
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddInstallment, setShowAddInstallment] = useState(false);
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [showOfferPrice, setShowOfferPrice] = useState(false);
  const [showEditProperty, setShowEditProperty] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<Array<{ id: string; file_name: string; public_url: string; type: string; size_bytes: number; created_at: string }>>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const refreshTick = useRealtimeRefresh();
  const [localTick, setLocalTick] = useState(0);
  const bumpRefresh = React.useCallback(() => setLocalTick((t) => t + 1), []);
  const unitsEditHref = React.useMemo(
    () =>
      userType === "agency"
        ? `/agency/properties/units?property_id=${property.id}`
        : `/dashboard/properties/units?property_id=${property.id}`,
    [property.id, userType],
  );

  useEffect(() => {
    let cancelled = false;
    if (!canMutateProperties) {
      setCommissionTotals(null);
      return;
    }
    void (async () => {
      try {
        const y = new Date().getFullYear();
        const m = String(new Date().getMonth() + 1).padStart(2, "0");
        const url = new URL("/api/agency/commissions", window.location.origin);
        url.searchParams.set("year", String(y));
        url.searchParams.set("month", `${y}-${m}`);
        url.searchParams.set("property_id", String(property.id));
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCommissionTotals({
          totalCommissionSar: Number(data?.totalCommissionSar) || 0,
          monthCommissionSar: Number(data?.monthCommissionSar) || 0,
          yearCommissionSar: Number(data?.yearCommissionSar) || 0,
        });
      } catch {
        if (!cancelled) setCommissionTotals(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canMutateProperties, property.id, refreshTick, localTick]);

  useEffect(() => {
    let cancelled = false;
    if (!editingContractId) {
      setEditContractForm(null);
      setEditError(null);
      return;
    }
    void (async () => {
      setEditError(null);
      const res = await fetch(`/api/contracts/${editingContractId}`);
      if (cancelled || !res.ok) return;
      const c = await res.json();
      if (cancelled || !c) return;
      setEditContractForm({
        unitId: c.unit_id ? String(c.unit_id) : null,
        startDate: c.start_date ? String(c.start_date) : "",
        endDate: c.end_date ? String(c.end_date) : "",
        rent: String(Number(c.rent_total_sar) || 0),
        status: c.status === "ended" ? "ended" : c.status === "cancelled" ? "cancelled" : "active",
        tenantName: c.contact?.name ? String(c.contact.name) : "—",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [editingContractId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedContract?.id) {
      setSelectedContractPayments([]);
      setCanGeneratePayments(false);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/contract-payments?contract_id=${selectedContract.id}`);
      if (cancelled) return;
      const data = res.ok ? await res.json() : [];
      if (cancelled) return;
      if (data?.summary) {
        setSelectedContractSummary(data.summary as OwnerContractSummary);
        setSelectedContractPayments([]);
        setCanGeneratePayments(false);
        return;
      }
      setSelectedContractSummary(null);
      setSelectedContractPayments(
        (Array.isArray(data) ? data : []).map((p: any) => ({
          id: String(p.id),
          due_date: p.due_date ? String(p.due_date) : "—",
          amount_sar: Number(p.amount_sar) || 0,
          status: String(p.status ?? ""),
          paid_at: p.paid_at ? String(p.paid_at) : null,
        })),
      );

      if (!data || data.length === 0) {
        const contractRes = await fetch(`/api/contracts/${selectedContract.id}`);
        if (!cancelled && contractRes.ok) {
          const contractRow = await contractRes.json();
          const plan = contractRow?.extra?.payments;
          setCanGeneratePayments(Array.isArray(plan) && plan.length > 0);
        } else {
          setCanGeneratePayments(false);
        }
      } else {
        setCanGeneratePayments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContract?.id, refreshTick, localTick]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [propRes, imagesRes] = await Promise.all([
        fetch(`/api/properties/${property.id}`),
        fetch(`/api/property-images?property_id=${property.id}`),
      ]);
      if (cancelled || !propRes.ok) return;
      const propData = await propRes.json();
      if (cancelled) return;

      if (imagesRes.ok) {
        const imgs = await imagesRes.json();
        if (!cancelled) setPropertyImages(imgs ?? []);
      }

      const contracts = propData.contracts ?? [];
      const units = propData.units ?? [];
      const rev = propData.revenues ?? [];
      const exp = propData.expenses ?? [];

      const unitLabelMap = new Map(units.map((u: any) => [String(u.id), String(u.label ?? "وحدة")]));
      const contactInfoMap = new Map<string, { name: string; phone: string | null }>(
        contracts
          .filter((c: any) => c.contact)
          .map((c: any) => [String(c.contact_id), { name: String(c.contact?.name ?? "—"), phone: c.contact?.phone ?? null }])
      );

      const mappedHistory = contracts.map((c: any) => ({
        id: String(c.id),
        tenant: ownerHidesTenantPii ? "" : c.contact?.name ? String(c.contact.name) : "—",
        summary: (c.owner_contract_summary as OwnerContractSummary | undefined) ?? null,
        unitId: c.unit_id ? String(c.unit_id) : null,
        unitLabel: c.unit_id ? (unitLabelMap.get(String(c.unit_id)) ?? "—") : "—",
        startDate: c.start_date ? String(c.start_date) : "—",
        endDate: c.end_date ? String(c.end_date) : "—",
        rent: Number(c.rent_total_sar) || 0,
        status: String(c.status ?? ""),
      }));
      setContractHistory(mappedHistory);

      const perUnit: Record<string, any[]> = {};
      for (const c of contracts) {
        if (!c?.unit_id) continue;
        const uid = String(c.unit_id);
        (perUnit[uid] ||= []).push(c);
      }
      const nextUnitContractMap: Record<
        string,
        { status: string; tenantName: string; startDate: string; endDate: string; summary?: OwnerContractSummary | null }
      > = {};
      for (const [uid, list] of Object.entries(perUnit)) {
        const active = list.find((x: any) => String(x.status) === "active") ?? null;
        const chosen = active ?? list[0] ?? null;
        if (!chosen) continue;
        nextUnitContractMap[uid] = {
          status: String(chosen.status ?? ""),
          tenantName: ownerHidesTenantPii ? "" : chosen.contact?.name ? String(chosen.contact.name) : "—",
          summary: (chosen.owner_contract_summary as OwnerContractSummary | undefined) ?? null,
          startDate: chosen.start_date ? String(chosen.start_date) : "—",
          endDate: chosen.end_date ? String(chosen.end_date) : "—",
        };
      }
      if (!cancelled) setUnitContractMap(nextUnitContractMap);

      const todayYmd = new Date().toISOString().split("T")[0];
      const activeNow = contracts.find(
        (c: any) =>
          String(c.status) === "active" &&
          (!c.start_date || String(c.start_date) <= todayYmd) &&
          (!c.end_date || String(c.end_date) >= todayYmd),
      ) ?? null;
      const current = activeNow ?? contracts[0] ?? null;
      setCurrentActiveContractId(activeNow?.id ? String(activeNow.id) : null);
      if (current) {
        setCurrentContractStart(current.start_date ? String(current.start_date) : "—");
        setCurrentContractEnd(current.end_date ? String(current.end_date) : "—");
        if (!cancelled) {
          if (ownerHidesTenantPii) {
            setCurrentContractSummary((current.owner_contract_summary as OwnerContractSummary) ?? null);
            setCurrentTenantName("—");
            setCurrentTenantPhone("—");
          } else {
            setCurrentContractSummary(null);
            const info = current.contact_id ? contactInfoMap.get(String(current.contact_id)) : null;
            setCurrentTenantName(info?.name ?? "—");
            setCurrentTenantPhone(info?.phone ?? "—");
          }
        }
      } else {
        setCurrentContractSummary(null);
        setCurrentTenantName("—");
        setCurrentTenantPhone("—");
        setCurrentContractStart("—");
        setCurrentContractEnd("—");
      }

      if (!cancelled) {
        setRevenues(
          rev.map((r: any) => ({
            id: String(r.id),
            type: "إيراد",
            amount: Number(r.amount_sar) || 0,
            status: "مسدد",
            date: r.received_at ? String(r.received_at).split("T")[0] : "",
            method: "—",
          })),
        );
        setExpenses(
          exp.map((e: any) => ({
            id: String(e.id),
            type: String(e.type ?? "مصروف"),
            amount: Number(e.amount_sar) || 0,
            status: "مسدد",
            date: e.paid_at ? String(e.paid_at).split("T")[0] : "",
            notes: String(e.description ?? ""),
          })),
        );
        // Load unit component images from backend
        const unitIds = units.map((u: any) => String(u.id));
        const unitImagesMap: Record<string, Array<{ id: string; url: string; component_id: string | null }>> = {};
        if (unitIds.length > 0) {
          await Promise.all(
            unitIds.map(async (uid: string) => {
              const imgRes = await fetch(`/api/property-images?unit_id=${uid}&image_type=component`);
              if (!imgRes.ok) return;
              const imgs: any[] = await imgRes.json();
              unitImagesMap[uid] = imgs.map((img: any) => ({
                id: String(img.id),
                url: String(img.public_url),
                component_id: img.component_id ? String(img.component_id) : null,
              }));
            }),
          );
        }

        setPropertyUnits(
          units.map((u: any) => {
            const unitImgs = unitImagesMap[String(u.id)] ?? [];
            const componentsByCompId: Record<string, Array<{ id: string; url: string }>> = {};
            for (const img of unitImgs) {
              const cid = img.component_id ?? "__none__";
              (componentsByCompId[cid] ||= []).push({ id: img.id, url: img.url });
            }
            return {
              id: String(u.id),
              label: String(u.label ?? "وحدة"),
              unit_type: u.unit_type ? String(u.unit_type) : null,
              price_sar: Number(u.rent_amount) || 0,
              sort_order: 0,
              status: u.status ? String(u.status) : null,
              area_sqm: u.area_sqm != null ? Number(u.area_sqm) : null,
              description: u.description ? String(u.description) : null,
              floor: u.floor ? String(u.floor) : null,
              components: Object.entries(componentsByCompId).map(([cid, imgs]) => ({
                id: cid,
                type: "gallery",
                label: "",
                images: imgs,
              })),
            };
          }),
        );

        // Compute occupancy from units
        const total = units.length;
        const occupied = units.filter((u: any) => u.status === "occupied").length;
        setOccupancyRate(total > 0 ? Math.round((occupied / total) * 100) : 0);

        const paymentsAll = propData.payments ?? [];
        if (ownerHidesTenantPii && current?.owner_contract_summary) {
          const s = current.owner_contract_summary as OwnerContractSummary;
          setUncollectedSar(s.rent_remaining_sar ?? 0);
          setNextPaymentAmount(s.next_rent_amount_sar);
          setNextPaymentDate(
            s.days_until_next_rent_due != null ? formatDaysUntilAr(s.days_until_next_rent_due) : "—",
          );
          setCollectionRatePercent(0);
        } else {
          const unpaid = paymentsAll.filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + (Number(p.amount_sar) || 0), 0);
          setUncollectedSar(unpaid);
          const next = paymentsAll.find((p: any) => p.status !== "paid" && p.due_date);
          setNextPaymentDate(next?.due_date ? String(next.due_date) : "—");
          setNextPaymentAmount(next ? Number(next.amount_sar) || null : null);
          const paid = paymentsAll.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (Number(p.amount_sar) || 0), 0);
          const totalPayments = paymentsAll.reduce((s: number, p: any) => s + (Number(p.amount_sar) || 0), 0);
          setCollectionRatePercent(totalPayments > 0 ? Math.round((paid / totalPayments) * 100) : 0);
        }

        // Units total rent
        const sum = units.reduce((s: number, u: any) => s + (Number(u.rent_amount) || 0), 0);
        setUnitsTotalRent(sum > 0 ? sum : null);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [property.id, property.units_count, refreshTick, localTick, ownerHidesTenantPii]);

  // Load documents when tab is active
  useEffect(() => {
    if (activeTab !== "documents") return;
    setDocsLoading(true);
    fetch(`/api/documents?property_id=${property.id}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [activeTab, property.id, refreshTick, localTick]);

  async function handleDocUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const uploaded: typeof documents = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("property_id", property.id);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (res.ok) {
        const doc = await res.json();
        uploaded.push({
          id: String(doc.id),
          file_name: String(doc.file_name),
          public_url: String(doc.public_url),
          type: String(doc.type ?? "other"),
          size_bytes: Number(doc.size_bytes) || 0,
          created_at: String(doc.created_at ?? ""),
        });
      }
    }
    if (uploaded.length > 0) setDocuments((prev) => [...uploaded, ...prev]);
  }

  async function handleDocDelete(docId: string) {
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-primary dark:text-gray-400"
        >
          <ChevronLeft className="h-4 w-4" />
          العقارات
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 dark:text-white">{property.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{property.name}</h1>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {property.property_model_type || "—"}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            {[property.city, property.neighborhood, property.address].filter(Boolean).join("، ") || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canMutateProperties ? (
            <>
              <button
                onClick={() => setShowEditProperty(true)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
              >
                <Edit className="h-4 w-4" />
                تعديل
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800/50 dark:bg-[#1a3528] dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 dark:border-emerald-800/30">
        {[
          { id: "info", label: "معلومات العقار" },
          { id: "units", label: "الوحدات" },
          { id: "contracts", label: "العقود" },
          { id: "financial", label: "المالية" },
          { id: "documents", label: "المستندات" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.id
                ? "text-primary"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "info" && (
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Property Image */}
            <div className="lg:col-span-1">
              <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                {/* Dynamic image gallery */}
                {propertyImages.length > 0 ? (
                  <div className="relative h-48 overflow-hidden rounded-lg bg-gray-100 dark:bg-[#0f1e14]">
                    <img
                      src={propertyImages[0].public_url}
                      alt={property.name}
                      className="h-full w-full object-cover"
                    />
                    {propertyImages.length > 1 && (
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {propertyImages.slice(1, 4).map((img) => (
                          <img
                            key={img.id}
                            src={img.public_url}
                            alt=""
                            className="h-10 w-10 rounded border-2 border-white object-cover"
                          />
                        ))}
                        {propertyImages.length > 4 && (
                          <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-white bg-black/60 text-xs font-bold text-white">
                            +{propertyImages.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                    {canMutateProperties ? (
                      <button
                        type="button"
                        onClick={() => propertyImages[0] && void fetch(`/api/property-images/${propertyImages[0].id}`, { method: "DELETE" }).then(() => setPropertyImages((prev) => prev.filter((_, i) => i !== 0)))}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-600"
                        title="حذف الصورة"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:border-emerald-800/50 dark:bg-[#0f1e14]">
                    <ImageIcon className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-xs text-gray-400">لا توجد صور</p>
                  </div>
                )}
                {/* Upload button */}
                {canMutateProperties ? (
                <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setUploadingImage(true);
                    try {
                      const uploaded: Array<{ id: string; public_url: string; image_type: string }> = [];
                      let currentCount = propertyImages.length;
                      for (const file of Array.from(files)) {
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("property_id", property.id);
                        // First image becomes the cover/thumbnail
                        fd.append("image_type", currentCount === 0 ? "cover" : "gallery");
                        const res = await fetch("/api/property-images", { method: "POST", body: fd });
                        if (res.ok) { uploaded.push(await res.json()); currentCount++; }
                      }
                      if (uploaded.length > 0) setPropertyImages((prev) => [...prev, ...uploaded]);
                    } finally {
                      setUploadingImage(false);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingImage ? "جاري الرفع..." : "إضافة صور"}
                </button>
                </>
                ) : null}
                {ownerHidesTenantPii ? (
                  <div className="mt-4">
                    <OwnerContractSummaryCards summary={currentContractSummary} compact />
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">المستأجر الحالي</span>
                      <span className="font-medium text-gray-900 dark:text-white">{currentTenantName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">رقم الجوال</span>
                      <span className="font-medium text-gray-900 dark:text-white" dir="ltr">
                        {currentTenantPhone}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Occupancy Rate */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">نسبة التحصيل</span>
                    <Percent className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="mt-2 flex items-center justify-center">
                    <div className="relative h-20 w-20">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="3"
                          strokeDasharray={`${occupancyRate}, 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-indigo-600">
                        {occupancyRate}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Annual Rent */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">إجمالي الإيجار/الإيرادات</span>
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {(unitsTotalRent ?? 0).toLocaleString()}
                    <span className="mr-1 text-sm font-normal text-gray-500">ر.س</span>
                  </p>
                  {unitsTotalRent != null ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">محسوب من أسعار الوحدات</p>
                  ) : null}
                </div>

                {/* Total Expenses */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">إجمالي التكاليف</span>
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toLocaleString()}
                    <span className="mr-1 text-sm font-normal text-gray-500">ر.س</span>
                  </p>
                </div>

                {/* Agency: Owner + Commission */}
                {canMutateProperties ? (
                  <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">المالك والعمولة</span>
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">المالك</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{property.owner_name ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">جوال المالك</span>
                        <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                          {property.owner_phone ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">نسبة العمولة</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {property.commission_percent != null ? `${Number(property.commission_percent)}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">ربح المكتب (عمولة)</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {(commissionTotals?.totalCommissionSar ?? 0).toLocaleString("ar-SA")}{" "}
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">ر.س</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">عمولة هذا الشهر</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {(commissionTotals?.monthCommissionSar ?? 0).toLocaleString("ar-SA")}{" "}
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">ر.س</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Owner: Managing office */}
                {!canMutate && property.managing_office_name ? (
                  <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">المكتب المكلّف بالعقار</span>
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">المكتب</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{property.managing_office_name ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">الجوال</span>
                        <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                          {property.managing_office_phone ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">البريد</span>
                        <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                          {property.managing_office_email ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">نسبة العمولة</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {property.commission_percent != null ? `${Number(property.commission_percent)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Net Income Rate */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">نسبة صافي الدخل</span>
                    <Percent className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    %{" "}
                    {(() => {
                      const income = Number(unitsTotalRent ?? 0);
                      const exp = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
                      if (income <= 0) return "0";
                      return (((income - exp) / income) * 100).toFixed(2);
                    })()}
                  </p>
                </div>

                {/* Management Fee */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">نسبة إجمالي الدخل</span>
                    <Percent className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    % {collectionRatePercent.toFixed(2)}
                  </p>
                </div>

                {/* Property Area */}
                <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">مساحة العقار</span>
                    <Home className="h-5 w-5 text-orange-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                    {property.area_m2 ? `${property.area_m2}² م` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">الموقع على الخريطة</h3>
              {(() => {
                const addressText = [property.city, property.neighborhood, property.address].filter(Boolean).join("، ");
                const link = googleMapsLink({
                  latitude: (property as any).latitude,
                  longitude: (property as any).longitude,
                  addressText,
                });
                if (!link) return null;
                return (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
                  >
                    فتح في خرائط Google
                  </a>
                );
              })()}
            </div>
            {(() => {
              const addressText = [property.city, property.neighborhood, property.address].filter(Boolean).join("، ");
              const src = googleMapsEmbedSrc({
                latitude: (property as any).latitude,
                longitude: (property as any).longitude,
                addressText,
              });
              if (!src) {
                return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 dark:border-emerald-800/50 dark:text-gray-400">أضف العنوان أو الإحداثيات لعرض الخريطة</div>;
              }
              return (
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-emerald-800/30">
                  <iframe title="property-map" src={src} className="h-64 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              );
            })()}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {(() => {
                const lat = (property as any).latitude;
                const lng = (property as any).longitude;
                if (lat != null && lng != null) return `الإحداثيات: ${lat}, ${lng}`;
                return "نصيحة: أدخل الإحداثيات من شاشة تعديل العقار للحصول على دقة أعلى.";
              })()}
            </p>
          </div>

          {/* Contract Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">العقد الحالي</h3>
              {canManageContracts ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddContract(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                  >
                    تعديل العقد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelContract(true)}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    إلغاء العقد
                  </button>
                </div>
              ) : null}
            </div>
            {ownerHidesTenantPii ? (
              <OwnerContractSummaryCards summary={currentContractSummary} />
            ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">اسم المستأجر</span>
                <p className="font-medium text-gray-900 dark:text-white">{currentTenantName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">رقم الجوال</span>
                <p className="font-medium text-gray-900 dark:text-white" dir="ltr">
                  {currentTenantPhone}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">تاريخ بداية العقد</span>
                <p className="font-medium text-gray-900 dark:text-white">{currentContractStart}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">تاريخ نهاية العقد</span>
                <p className="font-medium text-gray-900 dark:text-white">{currentContractEnd}</p>
              </div>
            </div>
            )}
          </div>

          {/* Expenses Table */}
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-emerald-800/30">
              <h3 className="font-semibold text-gray-900 dark:text-white">المصروفات</h3>
              {canMutate ? (
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  إضافة
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الملاحظات</th>
                    <th className="px-4 py-3 text-right font-medium">نوع المدفوعات</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">حالة الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">جهة الاتصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {expense.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{expense.amount.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">-</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{currentTenantName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenues Table */}
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-emerald-800/30">
              <h3 className="font-semibold text-gray-900 dark:text-white">الإيرادات</h3>
              {canMutate ? (
                <button
                  onClick={() => setShowAddRevenue(true)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  إضافة
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">ملاحظات</th>
                    <th className="px-4 py-3 text-right font-medium">نوع المدفوعات</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">حالة الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">طريقة الدفع</th>
                    <th className="px-4 py-3 text-right font-medium">جهة الاتصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {revenues.map((revenue) => (
                    <tr key={revenue.id} className="hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {revenue.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{revenue.amount.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {revenue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{revenue.date}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{revenue.method}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{currentTenantName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "units" && (
        <div className="space-y-4">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2">
                {canMutateProperties ? (
                  <Link
                    href={unitsEditHref}
                    className="text-lg font-bold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  >
                    الوحدات
                  </Link>
                ) : (
                  <span className="text-lg font-bold text-gray-900 dark:text-white">الوحدات</span>
                )}
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  {propertyUnits.length}
                </span>
              </h3>
              {propertyUnits.length > 0 && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  إجمالي الإيجار:{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {propertyUnits.reduce((s, u) => s + u.price_sar, 0).toLocaleString()} ر.س
                  </span>
                </p>
              )}
            </div>
            {canMutateProperties ? (
              <a
                href={unitsEditHref}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                <Edit className="h-4 w-4" />
                تعديل الوحدات
              </a>
            ) : null}
          </div>

          {propertyUnits.length === 0 ? (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <Building2 className="mx-auto h-16 w-16 text-gray-200 dark:text-gray-700" />
              <p className="mt-4 font-medium text-gray-500 dark:text-gray-400">لا توجد وحدات متاحة</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">اضغط على "تعديل الوحدات" لإنشاء الوحدات</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {propertyUnits.map((unit, idx) => {
                const bedrooms = unit.components.filter((c) => c.type === "bedroom").length;
                const bathrooms = unit.components.filter((c) => c.type === "bathroom").length;
                const livingRooms = unit.components.filter((c) => c.type === "living_room").length;
                const offices = unit.components.filter((c) => c.type === "office").length;
                const hasKitchen = unit.components.some((c) => c.type === "kitchen");
                const hasBalcony = unit.components.some((c) => c.type === "balcony");
                const allImages = unit.components.flatMap((c) => c.images ?? []).filter((img) => img.url);
                const contract = unitContractMap[unit.id];
                const isOccupied = contract?.status === "active";
                return (
                  <div
                    key={unit.id}
                    onClick={() => openUnitModal(unit.id)}
                    className="cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-emerald-800/30 dark:bg-[#132a1f]"
                  >
                    {/* Unit image gallery or placeholder */}
                    {allImages.length > 0 ? (
                      <div className="relative h-44 overflow-hidden bg-gray-100 dark:bg-[#0f1e14]">
                        <img
                          src={allImages[0].url}
                          alt={unit.label}
                          className="h-full w-full object-cover"
                        />
                        {allImages.length > 1 && (
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            {allImages.slice(1, 4).map((img, i) => (
                              <img
                                key={i}
                                src={img.url}
                                alt=""
                                className="h-10 w-10 rounded-lg border-2 border-white object-cover dark:border-gray-800"
                              />
                            ))}
                            {allImages.length > 4 && (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white bg-black/60 text-xs font-bold text-white">
                                +{allImages.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="absolute right-2 top-2">
                          <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/10">
                        <div className="text-center">
                          <Home className="mx-auto h-10 w-10 text-indigo-300 dark:text-indigo-700" />
                          <p className="mt-1 text-xs text-indigo-400">لا توجد صور</p>
                        </div>
                        <div className="absolute right-2 top-2">
                          <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Unit info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="truncate text-right font-bold text-gray-900 dark:text-white">
                            {unit.label}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                isOccupied
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
                              ].join(" ")}
                            >
                              {isOccupied ? "مؤجرة" : "شاغرة"}
                            </span>
                            {ownerHidesTenantPii && contract?.summary ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDaysUntilAr(contract.summary.days_until_contract_end)}
                              </span>
                            ) : contract?.tenantName ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                المستأجر: <span className="font-semibold text-gray-900 dark:text-white">{contract.tenantName}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {unit.price_sar > 0 ? `${unit.price_sar.toLocaleString()} ر.س` : "لم يحدد"}
                        </span>
                      </div>

                      {/* Quick stats chips */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {bedrooms > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            🛏 {bedrooms} غرفة نوم
                          </span>
                        )}
                        {offices > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:bg-slate-900/20 dark:text-slate-300">
                            💼 {offices} مساحة عمل
                          </span>
                        )}
                        {bathrooms > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400">
                            🚿 {bathrooms} حمام
                          </span>
                        )}
                        {livingRooms > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                            🛋 {livingRooms} صالون
                          </span>
                        )}
                        {hasKitchen && (
                          <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                            🍳 مطبخ
                          </span>
                        )}
                        {hasBalcony && (
                          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            🌿 بلكونة
                          </span>
                        )}
                      </div>

                      {contract ? (
                        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">العقد</p>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {contract.startDate} → {contract.endDate}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-500 dark:border-emerald-800/20 dark:bg-[#0f1e14] dark:text-gray-400">
                          لا يوجد عقد مرتبط بهذه الوحدة.
                        </div>
                      )}

                      {/* Components list */}
                      {unit.components.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">المكوّنات</p>
                          <div className="grid grid-cols-2 gap-2">
                            {unit.components.map((comp) => {
                              const img = comp.images?.find((i) => i.url);
                              return (
                                <div
                                  key={comp.id}
                                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-2 dark:border-emerald-800/20 dark:bg-[#0f1e14]"
                                >
                                  {img ? (
                                    <img
                                      src={img.url}
                                      alt={comp.label}
                                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg dark:bg-indigo-900/20">
                                      {comp.type === "bedroom" ? "🛏" : comp.type === "bathroom" ? "🚿" : comp.type === "kitchen" ? "🍳" : comp.type === "living_room" ? "🛋" : comp.type === "balcony" ? "🌿" : comp.type === "office" ? "💼" : comp.type === "storage" ? "📦" : "🏠"}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{comp.label}</p>
                                    <p className="text-xs text-gray-400">{unitComponentTypeLabel(comp.type)}{comp.sizeM2 ? ` • ${comp.sizeM2} م²` : ""}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          )}

          {selectedUnit && selectedUnitStats ? (
            <Modal isOpen={true} onClose={() => { setSelectedUnitId(null); setIsEditingUnit(false); }} title={isEditingUnit ? `تعديل ${selectedUnit.label}` : selectedUnit.label} size="lg">
              <div className="space-y-5">
                {canMutate && !isEditingUnit && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingUnit(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-300"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل الوحدة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedUnit) return;
                        const href =
                          userType === "agency"
                            ? `/agency/properties/units?property_id=${property.id}&edit_unit_id=${selectedUnit.id}`
                            : `/dashboard/properties/units?property_id=${property.id}&edit_unit_id=${selectedUnit.id}`;
                        router.push(href);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      المحرر المتكامل
                    </button>
                  </div>
                )}

                {isEditingUnit ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">اسم الوحدة</label>
                      <input
                        type="text"
                        value={unitEditForm.label}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, label: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        placeholder="مثال: شقة 1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الحالة</label>
                      <select
                        value={unitEditForm.status}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                      >
                        <option value="vacant">شاغرة</option>
                        <option value="occupied">مؤجرة</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">نوع الوحدة</label>
                      <select
                        value={unitEditForm.unit_type}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, unit_type: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                      >
                        <option value="apartment">شقة</option>
                        <option value="shop">محل</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الطابق</label>
                      <input
                        type="text"
                        value={unitEditForm.floor}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, floor: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        placeholder="مثال: 1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الإيجار (ر.س)</label>
                      <input
                        type="number"
                        value={unitEditForm.price_sar}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, price_sar: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        placeholder="10000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">المساحة (م²)</label>
                      <input
                        type="number"
                        value={unitEditForm.area_sqm}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, area_sqm: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        placeholder="120"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">الوصف</label>
                      <textarea
                        rows={2}
                        value={unitEditForm.description}
                        onChange={(e) => setUnitEditForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        placeholder="وصف الوحدة..."
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={savingUnit}
                        onClick={() => void handleSaveUnit()}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {savingUnit ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ
                      </button>
                      <button
                        type="button"
                        disabled={savingUnit}
                        onClick={() => setIsEditingUnit(false)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={savingUnit}
                        onClick={() => {
                          if (!selectedUnit) return;
                          const href =
                            userType === "agency"
                              ? `/agency/properties/units?property_id=${property.id}&edit_unit_id=${selectedUnit.id}`
                              : `/dashboard/properties/units?property_id=${property.id}&edit_unit_id=${selectedUnit.id}`;
                          router.push(href);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                        فتح المحرر المتكامل
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">الحالة</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                        {selectedUnitContract?.status === "active" ? "مؤجرة" : "شاغرة"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">السعر/الإيجار</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                        {selectedUnit.price_sar > 0 ? `${selectedUnit.price_sar.toLocaleString()} ر.س` : "لم يحدد"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">نوع الوحدة</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedUnit.unit_type ?? "—"}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">المكوّنات</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedUnit.components.length}</p>
                    </div>
                  </div>
                )}

                {selectedUnitImages.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">الصور</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {selectedUnitImages.slice(0, 8).map((image) => (
                        <img
                          key={image.id}
                          src={image.url}
                          alt={selectedUnit.label}
                          className="h-28 w-full rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-emerald-800/30 dark:text-gray-400">
                    لا توجد صور للوحدة.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {selectedUnitStats.livingRooms > 0 && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 dark:border-purple-900/30 dark:bg-purple-950/20">
                      <p className="text-xs text-purple-700 dark:text-purple-300">صالونات</p>
                      <p className="mt-1 font-semibold text-purple-950 dark:text-purple-100">{selectedUnitStats.livingRooms}</p>
                    </div>
                  )}
                  {selectedUnitStats.bedrooms > 0 && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
                      <p className="text-xs text-blue-700 dark:text-blue-300">غرف نوم</p>
                      <p className="mt-1 font-semibold text-blue-950 dark:text-blue-100">{selectedUnitStats.bedrooms}</p>
                    </div>
                  )}
                  {selectedUnitStats.bathrooms > 0 && (
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 dark:border-cyan-900/30 dark:bg-cyan-950/20">
                      <p className="text-xs text-cyan-700 dark:text-cyan-300">حمامات</p>
                      <p className="mt-1 font-semibold text-cyan-950 dark:text-cyan-100">{selectedUnitStats.bathrooms}</p>
                    </div>
                  )}
                  {selectedUnitStats.offices > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-900/30 dark:bg-slate-950/20">
                      <p className="text-xs text-slate-700 dark:text-slate-300">مساحات عمل</p>
                      <p className="mt-1 font-semibold text-slate-950 dark:text-slate-100">{selectedUnitStats.offices}</p>
                    </div>
                  )}
                  {selectedUnitStats.hasKitchen && (
                    <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 dark:border-orange-900/30 dark:bg-orange-950/20">
                      <p className="text-xs text-orange-700 dark:text-orange-300">مطبخ</p>
                      <p className="mt-1 font-semibold text-orange-950 dark:text-orange-100">متوفر</p>
                    </div>
                  )}
                  {selectedUnitStats.hasBalcony && (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-3 dark:border-green-900/30 dark:bg-green-950/20">
                      <p className="text-xs text-green-700 dark:text-green-300">بلكونة</p>
                      <p className="mt-1 font-semibold text-green-950 dark:text-green-100">متوفرة</p>
                    </div>
                  )}
                </div>

                {selectedUnitContract ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">العقد</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {!ownerHidesTenantPii ? (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">المستأجر</p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedUnitContract.tenantName}</p>
                        </div>
                      ) : selectedUnitContract.summary ? (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">ملخص العقد</p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                            يتبقى {formatDaysUntilAr(selectedUnitContract.summary.days_until_contract_end, "يتبقى")}
                          </p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ العقد</p>
                        <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                          {selectedUnitContract.startDate} → {selectedUnitContract.endDate}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-emerald-800/30 dark:text-gray-400">
                    لا يوجد عقد مرتبط بهذه الوحدة.
                  </div>
                )}

                <div>
                  <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">المكوّنات</p>
                  {selectedUnit.components.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedUnit.components.map((component) => {
                        const image = component.images?.find((item) => item.url);
                        return (
                          <div
                            key={component.id}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]"
                          >
                            {image ? (
                              <img
                                src={image.url}
                                alt={component.label}
                                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xl dark:bg-indigo-900/20">
                                {component.type === "bedroom" ? "🛏" : component.type === "bathroom" ? "🚿" : component.type === "kitchen" ? "🍳" : component.type === "living_room" ? "🛋" : component.type === "balcony" ? "🌿" : component.type === "office" ? "💼" : component.type === "storage" ? "📦" : "🏠"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white">{component.label}</p>
                              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                {unitComponentTypeLabel(component.type)}
                                {component.sizeM2 ? ` • ${component.sizeM2} م²` : ""}
                              </p>
                              {component.description ? (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{component.description}</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-emerald-800/30 dark:text-gray-400">
                      لا توجد مكوّنات للوحدة.
                    </div>
                  )}
                </div>
              </div>
            </Modal>
          ) : null}

          {activeTab === "contracts" && (
        <div className="space-y-4">
          {/* Contract History */}
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="border-b border-gray-100 p-4 dark:border-emerald-800/30">
              <h3 className="font-semibold text-gray-900 dark:text-white">سجل العقود</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-[#1a3528] dark:text-gray-400">
                  <tr>
                    {!ownerHidesTenantPii ? (
                      <th className="px-4 py-3 text-right font-medium">اسم المستأجر</th>
                    ) : (
                      <th className="px-4 py-3 text-right font-medium">ملخص العقد</th>
                    )}
                    <th className="px-4 py-3 text-right font-medium">الوحدة</th>
                    <th className="px-4 py-3 text-right font-medium">بداية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">نهاية العقد</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                  {contractHistory.map((contract) => (
                    <tr
                      key={contract.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a3528]/50"
                      onClick={() => {
                        setSelectedContract(contract);
                        setSelectedContractSummary(contract.summary ?? null);
                      }}
                      title="عرض تفاصيل العقد"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {ownerHidesTenantPii && contract.summary
                          ? formatDaysUntilAr(contract.summary.days_until_contract_end)
                          : contract.tenant}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{contract.unitLabel}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{contract.startDate}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{contract.endDate}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{contract.rent.toLocaleString()} ر.س</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {contract.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canManageContracts ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingContractId(contract.id);
                              }}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-gray-200 dark:hover:bg-emerald-800/20"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingContractId(contract.id);
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                            >
                              حذف
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contract details modal */}
          {selectedContract ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">تفاصيل العقد</h3>
                  <button
                    onClick={() => setSelectedContract(null)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
                    aria-label="إغلاق"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {ownerHidesTenantPii ? (
                  <OwnerContractSummaryCards summary={selectedContractSummary} />
                ) : null}
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {!ownerHidesTenantPii ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">المستأجر</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedContract.tenant}</p>
                  </div>
                  ) : null}
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الوحدة</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedContract.unitLabel}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">بداية العقد</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedContract.startDate}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">نهاية العقد</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedContract.endDate}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">المبلغ</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                      {selectedContract.rent.toLocaleString()} ر.س
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الحالة</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedContract.status}</p>
                  </div>
                </div>

                {!ownerHidesTenantPii ? (
                <div className="mt-5 rounded-xl border border-gray-100 bg-white dark:border-emerald-800/20 dark:bg-[#0f1e14]">
                  <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-emerald-800/20">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">الدفوعات</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedContractPayments.length} دفعة
                    </p>
                  </div>
                  <div className="grid gap-3 border-b border-gray-100 p-3 text-sm dark:border-emerald-800/20 sm:grid-cols-3">
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-[#132a1f]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">إجمالي الدفوعات</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">
                        {selectedContractPayments.reduce((s, p) => s + (Number(p.amount_sar) || 0), 0).toLocaleString()} ر.س
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/10">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">المدفوع</p>
                      <p className="mt-1 font-bold text-emerald-800 dark:text-emerald-200">
                        {selectedContractPayments
                          .filter((p) => p.status === "paid")
                          .reduce((s, p) => s + (Number(p.amount_sar) || 0), 0)
                          .toLocaleString()}{" "}
                        ر.س
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
                      <p className="text-xs text-amber-700 dark:text-amber-300">المتبقي</p>
                      <p className="mt-1 font-bold text-amber-800 dark:text-amber-200">
                        {(
                          selectedContractPayments.reduce((s, p) => s + (Number(p.amount_sar) || 0), 0) -
                          selectedContractPayments
                            .filter((p) => p.status === "paid")
                            .reduce((s, p) => s + (Number(p.amount_sar) || 0), 0)
                        ).toLocaleString()}{" "}
                        ر.س
                      </p>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {selectedContractPayments.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        لا توجد دفوعات لهذا العقد.
                        {canGeneratePayments ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              disabled={generatingPayments}
                              onClick={() => {
                                if (!selectedContract?.id) return;
                                void (async () => {
                                  setGeneratingPayments(true);
                                  try {
                                    const contractRes = await fetch(`/api/contracts/${selectedContract.id}`);
                                    if (!contractRes.ok) return;
                                    const contractRow = await contractRes.json();
                                    const plan = contractRow?.extra?.payments;
                                    if (!Array.isArray(plan) || plan.length === 0) return;
                                    const rows = plan
                                      .filter((p: any) => p && p.date && Number(p.amount) > 0)
                                      .map((p: any) => ({
                                        contract_id: selectedContract.id,
                                        due_date: String(p.date),
                                        amount_sar: Number(p.amount) || 0,
                                        status: "pending" as const,
                                        notes: p.note || null,
                                      }));
                                    if (rows.length > 0) {
                                      await fetch("/api/contract-payments", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ batch: rows }),
                                      });
                                    }
                                  } finally {
                                    setGeneratingPayments(false);
                                  }
                                })();
                              }}
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {generatingPayments ? "جاري التوليد..." : "توليد الدفوعات من العقد"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 dark:bg-[#132a1f] dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium">تاريخ الاستحقاق</th>
                            <th className="px-3 py-2 text-right font-medium">المبلغ</th>
                            <th className="px-3 py-2 text-right font-medium">الحالة</th>
                            <th className="px-3 py-2 text-right font-medium">تاريخ الدفع</th>
                            <th className="px-3 py-2 text-right font-medium">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-emerald-800/20">
                          {selectedContractPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#132a1f]/50">
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.due_date}</td>
                              <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                                {p.amount_sar.toLocaleString()} ر.س
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={[
                                    "rounded-full px-2 py-0.5 text-xs font-medium",
                                    p.status === "paid"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                  ].join(" ")}
                                >
                                  {p.status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                                {p.paid_at ? String(p.paid_at).split("T")[0] : "—"}
                              </td>
                              <td className="px-3 py-2">
                                {p.status === "paid" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void fetch(`/api/contract-payments/${p.id}`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ status: "pending", paid_at: null }),
                                      });
                                    }}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-gray-200 dark:hover:bg-emerald-800/20"
                                  >
                                    رجّعها معلقة
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void fetch(`/api/contract-payments/${p.id}`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
                                      });
                                    }}
                                    className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                                  >
                                    علّمها مدفوعة
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                  {canManageContracts ? (
                    <>
                      <button
                        onClick={() => {
                          if (!selectedContract?.id) return;
                          setEditingContractId(selectedContract.id);
                        }}
                        className="mr-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-gray-200 dark:hover:bg-emerald-800/20"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedContract?.id) return;
                          setDeletingContractId(selectedContract.id);
                        }}
                        className="mr-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                      >
                        حذف
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={() => setSelectedContract(null)}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    تم
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Edit contract modal */}
          {editingContractId && editContractForm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">تعديل العقد</h3>
                  <button
                    onClick={() => setEditingContractId(null)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
                    aria-label="إغلاق"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {editError ? (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {editError}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">المستأجر</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{editContractForm.tenantName}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الوحدة</label>
                    <select
                      value={editContractForm.unitId ?? ""}
                      onChange={(e) => setEditContractForm((p) => (p ? { ...p, unitId: e.target.value || null } : p))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                    >
                      <option value="">— بدون وحدة —</option>
                      {propertyUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">الحالة</label>
                    <select
                      value={editContractForm.status}
                      onChange={(e) =>
                        setEditContractForm((p) =>
                          p ? { ...p, status: e.target.value as any } : p,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                    >
                      <option value="active">active</option>
                      <option value="ended">ended</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">بداية العقد</label>
                    <input
                      type="date"
                      value={editContractForm.startDate}
                      onChange={(e) => setEditContractForm((p) => (p ? { ...p, startDate: e.target.value } : p))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">نهاية العقد</label>
                    <input
                      type="date"
                      value={editContractForm.endDate}
                      onChange={(e) => setEditContractForm((p) => (p ? { ...p, endDate: e.target.value } : p))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ</label>
                    <input
                      type="number"
                      min={0}
                      value={editContractForm.rent}
                      onChange={(e) => setEditContractForm((p) => (p ? { ...p, rent: e.target.value } : p))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-indigo-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingContractId(null)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-gray-200"
                    disabled={editSaving}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingContractId || !editContractForm) return;
                      void (async () => {
                        setEditSaving(true);
                        setEditError(null);
                        try {
                          const rent = Number(editContractForm.rent) || 0;
                          if (!editContractForm.startDate || !editContractForm.endDate) {
                            setEditError("يرجى إدخال تواريخ العقد.");
                            return;
                          }
                          if (rent <= 0) {
                            setEditError("يرجى إدخال مبلغ أكبر من 0.");
                            return;
                          }
                          const res = await fetch(`/api/contracts/${editingContractId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              unit_id: editContractForm.unitId,
                              start_date: editContractForm.startDate,
                              end_date: editContractForm.endDate,
                              rent_total_sar: rent,
                              status: editContractForm.status,
                            }),
                          });
                          if (!res.ok) {
                            setEditError("تعذر التعديل");
                            return;
                          }
                          setEditingContractId(null);
                        } finally {
                          setEditSaving(false);
                        }
                      })();
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    disabled={editSaving}
                  >
                    {editSaving ? "جاري الحفظ..." : "حفظ"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Delete confirmation */}
          {deletingContractId ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">حذف العقد</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">هل أنت متأكد؟ سيتم حذف العقد وكل دفوعاته.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingContractId(null)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#102318] dark:text-gray-200"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        await fetch(`/api/contracts/${deletingContractId}`, { method: "DELETE" });
                        setDeletingContractId(null);
                        setSelectedContract(null);
                      })();
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === "financial" && (
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <span className="text-sm text-gray-500 dark:text-gray-400">الدفعة القادمة</span>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{nextPaymentDate}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <span className="text-sm text-gray-500 dark:text-gray-400">مبلغ الدفعة القادمة</span>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {nextPaymentAmount != null ? `${nextPaymentAmount.toLocaleString()} ر.س` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <span className="text-sm text-gray-500 dark:text-gray-400">نهاية العقد</span>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{currentContractEnd}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">(15 يوم)</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <span className="text-sm text-gray-500 dark:text-gray-400">المبالغ الغير متحصلة</span>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{uncollectedSar.toLocaleString()} ر.س</p>
            </div>
          </div>

          {/* Quick Actions */}
          {canMutate ? (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowAddContract(true)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                إضافة عقد
              </button>
              <button
                onClick={() => setShowAddInstallment(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
              >
                <Plus className="h-4 w-4" />
                إضافة دفعة
              </button>
              <button
                onClick={() => setShowAddInsurance(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-300"
              >
                <Plus className="h-4 w-4" />
                إضافة فاتورة
              </button>
              <button
                onClick={() => setShowOfferPrice(true)}
                className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:text-indigo-400"
              >
                <Calculator className="h-4 w-4" />
                عرض سعر
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-emerald-800/30">
              <h3 className="font-semibold text-gray-900 dark:text-white">مستندات العقار</h3>
              {canMutate ? (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  رفع ملف
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic"
                    className="hidden"
                    onChange={(e) => void handleDocUpload(e.target.files)}
                  />
                </label>
              ) : null}
            </div>

            {docsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1a3528]">
                  <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">لا توجد مستندات بعد</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">ارفع PDF أو صور أو ملفات Word/Excel</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-emerald-800/30">
                {documents.map((doc) => {
                  const isImage = doc.type === "image";
                  const isPdf = doc.type === "pdf";
                  const sizeKb = Math.round(doc.size_bytes / 1024);
                  const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString("ar-SA") : "—";
                  return (
                    <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-[#1a3528]/50">
                      {isImage ? (
                        <a href={doc.public_url} target="_blank" rel="noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-emerald-800/30">
                          <img src={doc.public_url} alt={doc.file_name} className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white ${isPdf ? "bg-red-500" : doc.type === "excel" ? "bg-emerald-500" : doc.type === "doc" ? "bg-blue-500" : "bg-gray-500"}`}>
                          <FileText className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{doc.file_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{sizeKb} KB · {date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.public_url}
                          target="_blank"
                          rel="noreferrer"
                          download={doc.file_name}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDocDelete(doc.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <DeleteConfirmationModal
        isOpen={showCancelContract}
        onClose={() => setShowCancelContract(false)}
        onConfirm={() => {
          void (async () => {
            // Find the active contract for this property and cancel it
            const res = await fetch(`/api/contracts?property_id=${property.id}`);
            if (!res.ok) return;
            const contracts = await res.json();
            const active = (contracts ?? []).find((c: any) => c.status === "active");
            if (active?.id) {
              const todayYmd = new Date().toISOString().split("T")[0];
              await fetch(`/api/contracts/${active.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled", end_date: todayYmd }),
              });
            }
          })();
          setShowCancelContract(false);
        }}
        propertyName={property.name}
      />
      <AddContractModal
        isOpen={showAddContract}
        onClose={() => setShowAddContract(false)}
        propertyId={property.id}
        onCreated={(c) =>
          setContractHistory((prev) => {
            const unitId = (c as any)?.unitId ? String((c as any).unitId) : null;
            const unitLabel = unitId ? (propertyUnits.find((u) => u.id === unitId)?.label ?? "—") : "—";
            return [
              {
                id: String((c as any).id),
                tenant: String((c as any).tenant ?? "—"),
                unitId,
                unitLabel,
                startDate: String((c as any).startDate ?? "—"),
                endDate: String((c as any).endDate ?? "—"),
                rent: Number((c as any).rent) || 0,
                status: String((c as any).status ?? ""),
              },
              ...prev,
            ];
          })
        }
      />
      <AddRevenueModal
        isOpen={showAddRevenue}
        onClose={() => setShowAddRevenue(false)}
        propertyId={property.id}
        onSuccess={bumpRefresh}
      />
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        propertyId={property.id}
        onSuccess={bumpRefresh}
      />
      <AddInstallmentModal
        isOpen={showAddInstallment}
        onClose={() => setShowAddInstallment(false)}
        contractId={currentActiveContractId}
        propertyId={property.id}
        onSuccess={bumpRefresh}
      />
      <AddInsuranceModal
        isOpen={showAddInsurance}
        onClose={() => setShowAddInsurance(false)}
        propertyId={property.id}
        onSuccess={bumpRefresh}
      />
      <OfferPriceModal
        isOpen={showOfferPrice}
        onClose={() => setShowOfferPrice(false)}
        onSuccess={bumpRefresh}
      />
      <EditPropertyModal
        key={property.id}
        isOpen={showEditProperty}
        onClose={() => setShowEditProperty(false)}
        property={property}
      />
    </div>
  );
}

export default function PropertiesPage() {
  return <PropertiesContent />;
}
