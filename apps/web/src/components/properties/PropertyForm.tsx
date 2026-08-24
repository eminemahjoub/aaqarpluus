"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Minus, Plus, ShieldCheck, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth-fetch";
import {
  lookupRegions,
  lookupCities,
  lookupNeighborhoods,
  reverseGeocode,
  type Region,
  type City,
  type Neighborhood,
} from "@/lib/geo";
import { CoordinatePicker } from "@/components/properties/CoordinatePicker";
import { FieldHelp } from "@/components/properties/FieldHelp";
import {
  PROPERTY_TYPES,
  PROPERTY_CONDITIONS,
  ZATCA_TAX_CATEGORIES,
  deedNumberSchema,
  propertyTypeSchema,
  ejarNumberSchema,
  commissionSchema,
  accountNumberSchema,
} from "@/lib/validation/properties";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "biannual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

const propertySchema = z.object({
  owner_id: z.string().uuid().optional().nullable(),
  property_type: propertyTypeSchema.optional().nullable(),
  title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
  region: z.string().optional(),
  city: z.string().min(1, "المدينة مطلوبة"),
  neighborhood: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  floors_count: z.number().int().positive("عدد الأدوار يجب أن يكون رقماً موجباً").optional().nullable(),
  area_m2: z.number().positive("المساحة يجب أن تكون أكبر من صفر").optional().nullable(),
  apartments_count: z.number().int().min(0).optional(),
  shops_count: z.number().int().min(0).optional(),
  other_units_count: z.number().int().min(0).optional(),
  payment_frequency: z.enum(["monthly", "quarterly", "biannual", "annual"]),
  lessor_type: z.string().optional(),
  commission_percent: commissionSchema.optional().nullable(),
  water_account: accountNumberSchema("رقم حساب المياه").optional().or(z.literal("")),
  electricity_account: accountNumberSchema("رقم حساب الكهرباء").optional().or(z.literal("")),
  title_deed_number: deedNumberSchema.optional().or(z.literal("")),
  description: z.string().max(2000, "الوصف طويل جداً").optional(),
  ejar_registered: z.boolean().optional(),
  ejar_number: ejarNumberSchema.optional().or(z.literal("")),
  zatca_tax_category: z.enum(["S", "Z", "O", "EX"]).optional().nullable(),
  construction_year: z
    .number()
    .int()
    .min(1900, "سنة إنشاء غير صحيحة")
    .max(2100, "سنة إنشاء غير صحيحة")
    .optional()
    .nullable(),
  property_condition: z.enum(["new", "good", "fair", "needs_work"]).optional().nullable(),
});

export type PropertyFormData = z.infer<typeof propertySchema>;

type LinkedOwner = { owner_id: string; full_name: string | null; email: string | null };
type CopyUnit = { id: string; label: string; area_sqm: number | null; floor: string | null };

interface PropertyFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PropertyFormData) => void;
  initialData?: Partial<PropertyFormData>;
  isSubmitting?: boolean;
  /** agency → linked-owner selector (office_owner_links) */
  userType?: string;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
      <legend className="px-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

export function PropertyForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  userType,
}: PropertyFormProps) {
  const isAgency = userType === "agency";
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<PropertyFormData | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [geoResolving, setGeoResolving] = useState(false);

  const city = watch("city");
  const region = watch("region");
  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const commission = watch("commission_percent") ?? 0;
  const ejarRegistered = watch("ejar_registered");

  // ---- geo data (async lookups; skeleton while loading) ----
  const { data: regions, isLoading: regionsLoading } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: lookupRegions,
    enabled: open,
  });
  const { data: cities, isLoading: citiesLoading } = useQuery<City[]>({
    queryKey: ["cities", region],
    queryFn: () => lookupCities(region ?? ""),
    enabled: open && Boolean(region),
  });
  const { data: neighborhoods, isLoading: neighborhoodsLoading } = useQuery<Neighborhood[]>({
    queryKey: ["neighborhoods", city],
    queryFn: () => lookupNeighborhoods(city ?? ""),
    enabled: open && Boolean(city),
  });

  const { data: owners } = useQuery<LinkedOwner[]>({
    queryKey: ["office-owners"],
    queryFn: async () => {
      const res = await authFetch("/api/offices/owners");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && isAgency,
  });

  const { data: copyUnits } = useQuery<CopyUnit[]>({
    queryKey: ["copy-units"],
    queryFn: async () => {
      const res = await authFetch("/api/units");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) reset(initialData);
  }, [open, initialData, reset]);

  // ---- city select → auto-fill coordinates (editable after) ----
  const onCityChange = (cityId: string) => {
    setValue("city", cityId, { shouldValidate: true });
    const found = cities?.find((c) => c.id === cityId);
    if (found) {
      setValue("latitude", found.lat, { shouldValidate: true });
      setValue("longitude", found.lng, { shouldValidate: true });
    }
  };

  // ---- debounced reverse-geocode when the user edits coordinates manually ----
  const geoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onManualCoordChange = (key: "latitude" | "longitude", value: number | undefined) => {
    setValue(key, value, { shouldValidate: true });
    if (geoDebounce.current) clearTimeout(geoDebounce.current);
    geoDebounce.current = setTimeout(async () => {
      const lat = key === "latitude" ? value : latitude;
      const lng = key === "longitude" ? value : longitude;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setGeoResolving(true);
        const nearest = await reverseGeocode(lat as number, lng as number);
        if (nearest) {
          setValue("region", nearest.regionId, { shouldValidate: true });
          setValue("city", nearest.id, { shouldValidate: true });
        }
        setGeoResolving(false);
      }
    }, 400);
  };

  // ---- copy from existing unit ----
  const copyFromUnit = (unitId: string) => {
    const u = copyUnits?.find((x) => x.id === unitId);
    if (!u) return;
    if (u.area_sqm != null) setValue("area_m2", Number(u.area_sqm), { shouldValidate: true });
    if (u.floor != null && /^\d+$/.test(String(u.floor))) {
      setValue("floors_count", Number(u.floor), { shouldValidate: true });
    }
  };

  const commissionStep = (delta: number) => {
    const next = Math.min(10, Math.max(0, Math.round(((commission as number) + delta) * 10) / 10));
    setValue("commission_percent", next, { shouldValidate: true });
  };

  const onSubmitAttempt = (data: PropertyFormData) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const confirmSubmit = () => {
    if (pendingData) onSubmit(pendingData);
    setConfirmOpen(false);
    setPendingData(null);
  };

  const isEdit = !!initialData?.title;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "تحديث عقار" : "إضافة عقار"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitAttempt)} className="space-y-5" noValidate>
            {/* ===== Basic info ===== */}
            <Section title="العنوان" icon={<Building2 className="h-4 w-4 text-emerald-600" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="p-title">العنوان *</Label>
                  <Input id="p-title" {...register("title")} placeholder="عقار الرياض" aria-describedby="p-title-err" />
                  {errors.title && (
                    <p id="p-title-err" role="alert" className="mt-1 text-sm text-red-500">{errors.title.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="p-type">
                    نوع العقار
                    <FieldHelp text="سكني: وحدات سكنية فقط — تجاري: محلات ومكاتب — متعدد: مزيج من الاثنين." />
                  </Label>
                  <select id="p-type" {...register("property_type")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                    <option value="">اختر النوع</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="p-owner">المالك</Label>
                  {isAgency && !owners ? (
                    <Skeleton className="h-10 w-full" />
                  ) : isAgency ? (
                    <select id="p-owner" {...register("owner_id")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                      <option value="">اختر المالك</option>
                      {(owners ?? []).map((o) => (
                        <option key={o.owner_id} value={o.owner_id}>{o.full_name ?? o.email ?? o.owner_id}</option>
                      ))}
                    </select>
                  ) : (
                    <Input disabled placeholder="المالك الحالي" />
                  )}
                </div>
              </div>
            </Section>

            {/* ===== Location & coordinates ===== */}
            <Section title="الموقع والإحداثيات">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-region">المنطقة</Label>
                  {regionsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <select
                      id="p-region"
                      {...register("region")}
                      onChange={(e) => {
                        setValue("region", e.target.value, { shouldValidate: true });
                        setValue("city", "", { shouldValidate: true });
                        setCityLoading(true);
                        lookupCities(e.target.value).finally(() => setCityLoading(false));
                      }}
                      className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="">اختر المنطقة</option>
                      {(regions ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.nameAr}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <Label htmlFor="p-city">المدينة *</Label>
                  {citiesLoading || cityLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <select id="p-city" value={city ?? ""} onChange={(e) => onCityChange(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                      <option value="">اختر المدينة</option>
                      {(cities ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.nameAr}</option>
                      ))}
                    </select>
                  )}
                  {errors.city && (
                    <p role="alert" className="mt-1 text-sm text-red-500">{errors.city.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="p-district">الحي</Label>
                  {neighborhoodsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <select id="p-district" {...register("neighborhood")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                      <option value="">اختر الحي</option>
                      {(neighborhoods ?? []).map((n) => (
                        <option key={n.id} value={n.id}>{n.nameAr}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <CoordinatePicker
                    latitude={latitude ?? undefined}
                    longitude={longitude ?? undefined}
                    onLatitudeChange={(v) => onManualCoordChange("latitude", v)}
                    onLongitudeChange={(v) => onManualCoordChange("longitude", v)}
                    cityName={cities?.find((c) => c.id === city)?.nameAr}
                  />
                  {geoResolving && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      جاري تحديد الموقع تلقائياً...
                    </p>
                  )}
                </div>
              </div>
            </Section>

            {/* ===== Unit details ===== */}
            <Section title="تفاصيل الوحدة">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="p-area">المساحة (م²)</Label>
                  <Input id="p-area" type="number" min={0} {...register("area_m2", { valueAsNumber: true })} placeholder="500" />
                  {errors.area_m2 && <p role="alert" className="mt-1 text-sm text-red-500">{errors.area_m2.message}</p>}
                </div>
                <div>
                  <Label htmlFor="p-floors">عدد الأدوار</Label>
                  <Input id="p-floors" type="number" min={1} {...register("floors_count", { valueAsNumber: true })} placeholder="5" />
                </div>
                <div>
                  <Label htmlFor="p-copy">نسخ من وحدة موجودة</Label>
                  <div className="flex items-center gap-1">
                    <select
                      id="p-copy"
                      onChange={(e) => copyFromUnit(e.target.value)}
                      defaultValue=""
                      className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="">اختر وحدة</option>
                      {(copyUnits ?? []).map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                    <Copy className="h-4 w-4 shrink-0 text-gray-400" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="p-apts">شقق</Label>
                  <Input id="p-apts" type="number" min={0} {...register("apartments_count", { valueAsNumber: true })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="p-shops">محلات</Label>
                  <Input id="p-shops" type="number" min={0} {...register("shops_count", { valueAsNumber: true })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="p-other">وحدات أخرى</Label>
                  <Input id="p-other" type="number" min={0} {...register("other_units_count", { valueAsNumber: true })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="p-year">سنة الإنشاء</Label>
                  <Input id="p-year" type="number" min={1900} max={2100} {...register("construction_year", { valueAsNumber: true })} placeholder="2015" />
                </div>
                <div>
                  <Label htmlFor="p-cond">حالة العقار</Label>
                  <select id="p-cond" {...register("property_condition")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                    <option value="">اختر الحالة</option>
                    {PROPERTY_CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* ===== Financials ===== */}
            <Section title="المالية">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-freq">تكرار الدفع *</Label>
                  <select id="p-freq" {...register("payment_frequency")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="p-lessor">نوع المؤجر</Label>
                  <Input id="p-lessor" {...register("lessor_type")} placeholder="مالك" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="p-commission">
                    نسبة العمولة (%)
                    <FieldHelp text="النسبة التي يستحقها المكتب من الإيجار — من 0% إلى 10% بخطوات 0.1%." />
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => commissionStep(-0.1)} aria-label="إنقاص العمولة">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <input
                      id="p-commission"
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={commission as number}
                      onChange={(e) => setValue("commission_percent", Number(e.target.value), { shouldValidate: true })}
                      className="h-2 flex-1 cursor-pointer accent-emerald-600"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => commissionStep(0.1)} aria-label="زيادة العمولة">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span dir="ltr" className="w-14 text-center font-semibold text-gray-900 dark:text-white">
                      {(commission as number).toFixed(1)}%
                    </span>
                  </div>
                  {errors.commission_percent && <p role="alert" className="mt-1 text-sm text-red-500">{errors.commission_percent.message}</p>}
                </div>
              </div>
            </Section>

            {/* ===== Compliance (EJAR/ZATCA) ===== */}
            <Section title="الامتثال" icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-zatca">الفئة الضريبية (ZATCA)</Label>
                  <select id="p-zatca" {...register("zatca_tax_category")} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                    <option value="">غير محدد</option>
                    {ZATCA_TAX_CATEGORIES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="p-ejar-toggle">تسجيل إيجار (EJAR)</Label>
                  <label className="flex cursor-pointer items-center gap-2 py-2">
                    <input
                      id="p-ejar-toggle"
                      type="checkbox"
                      checked={Boolean(ejarRegistered)}
                      onChange={(e) => setValue("ejar_registered", e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ejarRegistered ? "مسجل في إيجار" : "غير مسجل"}
                    </span>
                  </label>
                </div>
                {ejarRegistered && (
                  <div>
                    <Label htmlFor="p-ejar-num">
                      رقم التسجيل في إيجار
                      <FieldHelp text="الرقم التعريفي للعقد على منصة إيجار الحكومية — أرقام فقط." />
                    </Label>
                    <Input id="p-ejar-num" dir="ltr" {...register("ejar_number")} placeholder="123456789" />
                    {errors.ejar_number && <p role="alert" className="mt-1 text-sm text-red-500">{errors.ejar_number.message}</p>}
                  </div>
                )}
              </div>
            </Section>

            {/* ===== Utilities ===== */}
            <Section title="المرافق">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-water">
                    رقم حساب المياه
                    <FieldHelp text="رقم حساب شركة المياه — أرقام فقط، يُنسّق تلقائياً عند الإدخال." />
                  </Label>
                  <Input id="p-water" dir="ltr" {...register("water_account")} placeholder="12345678" />
                  {errors.water_account && <p role="alert" className="mt-1 text-sm text-red-500">{errors.water_account.message}</p>}
                </div>
                <div>
                  <Label htmlFor="p-elec">
                    رقم حساب الكهرباء
                    <FieldHelp text="رقم حساب الشركة السعودية للكهرباء — أرقام فقط." />
                  </Label>
                  <Input id="p-elec" dir="ltr" {...register("electricity_account")} placeholder="87654321" />
                  {errors.electricity_account && <p role="alert" className="mt-1 text-sm text-red-500">{errors.electricity_account.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="p-deed">
                    رقم الصك
                    <FieldHelp text="رقم صك الملكية الصادر من العدل — من 6 إلى 12 خانة رقمية، ويجب ألا يتكرر في النظام." />
                  </Label>
                  <Input id="p-deed" dir="ltr" {...register("title_deed_number")} placeholder="1012345678" />
                  {errors.title_deed_number && <p role="alert" className="mt-1 text-sm text-red-500">{errors.title_deed_number.message}</p>}
                </div>
              </div>
            </Section>

            {/* ===== Description ===== */}
            <Section title="الوصف">
              <textarea
                {...register("description")}
                rows={3}
                placeholder="وصف العقار..."
                aria-label="وصف العقار"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-500 focus-visible:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
              {errors.description && <p role="alert" className="mt-1 text-sm text-red-500">{errors.description.message}</p>}
            </Section>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "جاري الحفظ..." : isEdit ? "حفظ التحديثات" : "متابعة"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Confirm-before-submit summary ===== */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد البيانات</DialogTitle>
          </DialogHeader>
          {pendingData && (
            <div className="space-y-2 text-sm">
              <SummaryRow label="العنوان" value={pendingData.title} />
              <SummaryRow label="المدينة" value={cities?.find((c) => c.id === pendingData.city)?.nameAr ?? pendingData.city ?? "—"} />
              <SummaryRow label="نوع العقار" value={PROPERTY_TYPES.find((t) => t.value === pendingData.property_type)?.label ?? "—"} />
              <SummaryRow label="المساحة" value={pendingData.area_m2 != null ? `${pendingData.area_m2} م²` : "—"} />
              <SummaryRow label="الأدوار" value={pendingData.floors_count != null ? String(pendingData.floors_count) : "—"} />
              <SummaryRow
                label="الوحدات"
                value={`${pendingData.apartments_count ?? 0} شقة، ${pendingData.shops_count ?? 0} محل، ${pendingData.other_units_count ?? 0} أخرى`}
              />
              <SummaryRow label="تكرار الدفع" value={FREQUENCY_OPTIONS.find((f) => f.value === pendingData.payment_frequency)?.label ?? "—"} />
              <SummaryRow label="العمولة" value={pendingData.commission_percent != null ? `${pendingData.commission_percent}%` : "—"} />
              <SummaryRow label="رقم الصك" value={pendingData.title_deed_number || "—"} />
              <SummaryRow label="إيجار" value={pendingData.ejar_registered ? `مسجل (${pendingData.ejar_number || "بدون رقم"})` : "غير مسجل"} />
              <SummaryRow label="الفئة الضريبية" value={pendingData.zatca_tax_category ?? "غير محدد"} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              تراجع
            </Button>
            <Button type="button" onClick={confirmSubmit} disabled={isSubmitting}>
              تأكيد الحفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}