"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";

type DbProperty = {
  id: string;
  name: string;
  units_count: number;
  apartments_count: number;
  shops_count: number;
  other_units_count: number;
  unit_identifiers: string | null;
};

type ComponentType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "balcony"
  | "office"
  | "storage"
  | "maid_room";

type ComponentImage = { id: string; file?: File; url?: string };
type ComponentDraft = {
  id: string;
  type: ComponentType;
  label: string;
  sizeM2?: string;
  description?: string;
  images: ComponentImage[];
};

type UnitType = "apartment" | "shop" | "other";

type UnitDraft = {
  id: string;
  label: string;
  unitType: UnitType;
  priceSar?: number;
  defaults: {
    livingRooms: number;
    bedrooms: number;
    bathrooms: number;
    hasKitchen: boolean;
    hasBalcony: boolean;
  };
  components: ComponentDraft[];
};

function uuidv4Fallback(): string {
  // RFC4122 v4-ish UUID using crypto.getRandomValues when randomUUID isn't available.
  // This is required because `units.id` is a Postgres `uuid` column.
  const c = globalThis.crypto as Crypto | undefined;
  if (!c?.getRandomValues) {
    // As a last resort, return a valid-ish UUID shape (low collision resistance).
    const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s()}${s()}-${s()}-4${s().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s().slice(1)}-${s()}${s()}${s()}`;
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidv4Fallback();

const componentLabel = (type: ComponentType, index: number) => {
  switch (type) {
    case "living_room":
      return index === 1 ? "صالون" : `صالون ${index}`;
    case "bedroom":
      return `غرفة نوم ${index}`;
    case "kitchen":
      return "مطبخ";
    case "bathroom":
      return index === 1 ? "حمام" : `حمام ${index}`;
    case "balcony":
      return "بلكونة";
    case "office":
      return "مكتب";
    case "storage":
      return "مستودع";
    case "maid_room":
      return "غرفة خادمة";
  }
};

const defaultUnitDefaults = () => ({
  livingRooms: 1,
  bedrooms: 2,
  bathrooms: 2,
  hasKitchen: true,
  hasBalcony: true,
});

const defaultsForUnitType = (unitType: UnitType): UnitDraft["defaults"] => {
  if (unitType === "shop") {
    return {
      livingRooms: 1, // used as "workspaces/offices"
      bedrooms: 0,
      bathrooms: 1,
      hasKitchen: false,
      hasBalcony: false,
    };
  }
  if (unitType === "other") {
    return {
      livingRooms: 0,
      bedrooms: 0,
      bathrooms: 1,
      hasKitchen: false,
      hasBalcony: false,
    };
  }
  return defaultUnitDefaults();
};

const inferUnitTypeByIndex = (prop: DbProperty, idx: number): UnitType => {
  const a = Math.max(0, Number(prop.apartments_count) || 0);
  const s = Math.max(0, Number(prop.shops_count) || 0);
  if (idx < a) return "apartment";
  if (idx < a + s) return "shop";
  return "other";
};

const generateUnitComponents = (unitType: UnitType, defaults: UnitDraft["defaults"]): ComponentDraft[] => {
  const items: ComponentDraft[] = [];
  if (unitType === "shop") {
    for (let i = 1; i <= defaults.livingRooms; i++) {
      items.push({
        id: makeId(),
        type: "office",
        label: defaults.livingRooms === 1 ? "مساحة عمل" : `مساحة عمل ${i}`,
        images: [{ id: makeId() }],
      });
    }
  } else {
    for (let i = 1; i <= defaults.livingRooms; i++) {
      items.push({
        id: makeId(),
        type: "living_room",
        label: componentLabel("living_room", i),
        images: [{ id: makeId() }],
      });
    }
    for (let i = 1; i <= defaults.bedrooms; i++) {
      items.push({
        id: makeId(),
        type: "bedroom",
        label: componentLabel("bedroom", i),
        images: [{ id: makeId() }],
      });
    }
    if (defaults.hasKitchen) {
      items.push({
        id: makeId(),
        type: "kitchen",
        label: componentLabel("kitchen", 1),
        images: [{ id: makeId() }],
      });
    }
  }
  for (let i = 1; i <= defaults.bathrooms; i++) {
    items.push({
      id: makeId(),
      type: "bathroom",
      label: componentLabel("bathroom", i),
      images: [{ id: makeId() }],
    });
  }
  if (unitType !== "shop" && defaults.hasBalcony) {
    items.push({
      id: makeId(),
      type: "balcony",
      label: componentLabel("balcony", 1),
      images: [{ id: makeId() }],
    });
  }
  return items;
};

const serializeComponents = (components: ComponentDraft[]) =>
  components.map((c) => ({
    ...c,
    images: (c.images || []).map((img) => ({ id: img.id, url: img.url })),
  }));

export default function UnitsBuilderPage() {
  const [propertyId, setPropertyId] = React.useState<string | null>(null);
  const [property, setProperty] = React.useState<DbProperty | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [units, setUnits] = React.useState<UnitDraft[]>([]);
  const totalUnitsRent = React.useMemo(() => units.reduce((acc, u) => acc + (u.priceSar ?? 0), 0), [units]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const refreshTick = useRealtimeRefresh();

  const saveNow = React.useCallback(async () => {
    if (!propertyId) return;
    if (units.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Save each unit: PUT if it came from DB (UUID format), POST if local-only
      for (let idx = 0; idx < units.length; idx++) {
        const u = units[idx];
        const body = {
          property_id: propertyId,
          label: u.label,
          unit_type: u.unitType,
          rent_amount: Number(u.priceSar) || 0,
        };
        // Try PUT first (update existing), fall back to POST for new units
        const res = await authFetch(`/api/units/${u.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          // Might be a client-side generated ID; try to create
          await authFetch("/api/units", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      }
      setLastSavedAt(new Date().toISOString());
    } catch (e: any) {
      setSaveError(String(e?.message ?? "save_failed"));
    } finally {
      setSaving(false);
    }
  }, [propertyId, units]);

  const uploadComponentImages = React.useCallback(
    async ({ unitId, componentId, files }: { unitId: string; componentId: string; files: FileList }) => {
      const uploaded: ComponentImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("unit_id", unitId);
        fd.append("component_id", componentId);
        fd.append("image_type", "component");
        const res = await authFetch("/api/property-images", { method: "POST", body: fd });
        if (!res.ok) continue;
        const img = await res.json();
        uploaded.push({ id: String(img.id), url: String(img.public_url) });
      }
      if (uploaded.length === 0) return;
      // Replace local blob previews with persisted URLs
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id !== unitId) return u;
          return {
            ...u,
            components: u.components.map((c) => {
              if (c.id !== componentId) return c;
              // Clean up old blob URLs
              c.images.forEach((img) => img.url?.startsWith("blob:") && URL.revokeObjectURL(img.url));
              return { ...c, images: uploaded };
            }),
          };
        }),
      );
    },
    [],
  );

  React.useEffect(() => {
    // Read property_id from query string on client (avoid useSearchParams suspense issues)
    try {
      setPropertyId(new URLSearchParams(window.location.search).get("property_id"));
    } catch {
      setPropertyId(null);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!propertyId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const [propRes, unitsRes] = await Promise.all([
        authFetch(`/api/properties/${propertyId}`),
        authFetch(`/api/units?property_id=${propertyId}`),
      ]);
      if (cancelled) return;
      const [propData, dbUnits] = await Promise.all([
        propRes.ok ? propRes.json() : null,
        unitsRes.ok ? unitsRes.json() : [],
      ]);
      if (cancelled) return;

      const prop = propData ? {
        id: String(propData.id),
        name: String(propData.name),
        units_count: Number(propData.units_count) || 0,
        apartments_count: Number(propData.apartments_count) || 0,
        shops_count: Number(propData.shops_count) || 0,
        other_units_count: Number(propData.other_units_count) || 0,
        unit_identifiers: propData.unit_identifiers ?? null,
      } as DbProperty : null;
      setProperty(prop);

      // Auto-generate units if none exist yet
      if ((!dbUnits || dbUnits.length === 0) && prop && prop.units_count > 0) {
        const count = Math.max(0, Math.min(200, Number(prop.units_count)));
        const generatedUnits = Array.from({ length: count }, (_, idx) => {
          const n = idx + 1;
          const unitType = inferUnitTypeByIndex(prop, idx);
          const defaults = defaultsForUnitType(unitType);
          return {
            property_id: propertyId,
            label: count === 1 ? "الوحدة الرئيسية" : `وحدة ${n}`,
            unit_type: unitType,
            rent_amount: 0,
          };
        });
        // Create units via API
        const createdUnits = await Promise.all(
          generatedUnits.map((row) =>
            authFetch("/api/units", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(row),
            }).then((r) => r.ok ? r.json() : null)
          )
        );
        if (!cancelled) {
          setUnits(
            createdUnits.filter(Boolean).map((u: any, idx: number) => {
              const unitType: UnitType =
                u.unit_type === "shop" || u.unit_type === "other" || u.unit_type === "apartment"
                  ? (u.unit_type as UnitType)
                  : inferUnitTypeByIndex(prop, idx);
              return {
              id: String(u.id),
              label: String(u.label ?? "وحدة"),
                unitType,
                priceSar: u.rent_amount != null ? Number(u.rent_amount) : 0,
                defaults: defaultsForUnitType(unitType),
                components: [] as ComponentDraft[],
              };
            }),
          );
          setLoading(false);
          return;
        }
      }

      // Load component images from backend for each unit
      const unitImagesMap: Record<string, Record<string, ComponentImage[]>> = {};
      await Promise.all(
        (dbUnits ?? []).map(async (u: any) => {
          const imgRes = await authFetch(`/api/property-images?unit_id=${u.id}&image_type=component`);
          if (!imgRes.ok) return;
          const imgs: any[] = await imgRes.json();
          const byComponent: Record<string, ComponentImage[]> = {};
          for (const img of imgs) {
            const cid = img.component_id ?? "__none__";
            (byComponent[cid] ||= []).push({ id: String(img.id), url: String(img.public_url) });
          }
          unitImagesMap[String(u.id)] = byComponent;
        }),
      );

      const mapped: UnitDraft[] = (dbUnits ?? []).map((u: any, idx: number) => {
        const unitType: UnitType =
          u.unit_type === "shop" || u.unit_type === "other" || u.unit_type === "apartment"
            ? (u.unit_type as UnitType)
            : prop
              ? inferUnitTypeByIndex(prop as DbProperty, idx)
              : "apartment";
        const byComponent = unitImagesMap[String(u.id)] ?? {};
        const components: ComponentDraft[] = generateUnitComponents(unitType, defaultsForUnitType(unitType)).map((c) => ({
          ...c,
          images: byComponent[c.id] ?? [{ id: makeId() }],
        }));
        return {
          id: String(u.id),
          label: String(u.label ?? "وحدة"),
          unitType,
          priceSar: u.rent_amount != null ? Number(u.rent_amount) : 0,
          defaults: defaultsForUnitType(unitType),
          components,
        };
      });
      setUnits(mapped);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, refreshTick]);

  // Auto-save changes (best effort)
  React.useEffect(() => {
    if (!propertyId) return;
    if (units.length === 0) return;
    const t = setTimeout(() => {
      void saveNow();
    }, 800);
    return () => clearTimeout(t);
  }, [propertyId, units, saveNow]);

  const updateUnitDefaults = React.useCallback((unitId: string, patch: Partial<UnitDraft["defaults"]>) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const merged = { ...u.defaults, ...patch };
        if (u.unitType === "shop") {
          merged.bedrooms = 0;
          merged.hasKitchen = false;
          merged.hasBalcony = false;
        }
        return { ...u, defaults: merged };
      }),
    );
  }, []);

  const updateUnitPrice = React.useCallback((unitId: string, priceSar: number) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, priceSar } : u)));
  }, []);

  const regenerateUnit = React.useCallback((unitId: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        u.components.forEach((c) => c.images.forEach((img) => img.url && URL.revokeObjectURL(img.url)));
        return { ...u, components: generateUnitComponents(u.unitType, u.defaults) };
      }),
    );
  }, []);

  const removeComponent = React.useCallback((unitId: string, componentId: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const toRemove = u.components.find((c) => c.id === componentId);
        toRemove?.images.forEach((img) => img.url && URL.revokeObjectURL(img.url));
        return { ...u, components: u.components.filter((c) => c.id !== componentId) };
      }),
    );
  }, []);

  const updateComponent = React.useCallback((unitId: string, componentId: string, patch: Partial<ComponentDraft>) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        return { ...u, components: u.components.map((c) => (c.id === componentId ? { ...c, ...patch } : c)) };
      }),
    );
  }, []);

  const setComponentImages = React.useCallback((unitId: string, componentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Show local previews immediately, then upload to Storage and persist public URLs.
    const localPreviews: ComponentImage[] = Array.from(files).map((file) => ({
      id: makeId(),
      file,
      url: URL.createObjectURL(file),
    }));
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        return {
          ...u,
          components: u.components.map((c) => {
            if (c.id !== componentId) return c;
            c.images.forEach((img) => img.url && URL.revokeObjectURL(img.url));
            return { ...c, images: localPreviews.length > 0 ? localPreviews : [{ id: makeId() }] };
          }),
        };
      }),
    );
    void uploadComponentImages({ unitId, componentId, files });
  }, [uploadComponentImages]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-emerald-800/40 dark:bg-[#102318]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">جاري تحميل الوحدات...</p>
        </div>
      </div>
    );
  }

  if (!propertyId || !property) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-emerald-800/40 dark:bg-[#102318]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">لا توجد بيانات</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            افتح الصفحة من تفاصيل العقار (مع `property_id`) أو ارجع إلى صفحة العقارات.
          </p>
          <Link
            href="/dashboard/properties"
            className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            العودة للعقارات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">إكمال تفاصيل الوحدات</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            عدد الوحدات: {property.units_count}. أكمل تفاصيل كل وحدة ومكوّناتها.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {saveError
              ? `تعذر الحفظ: ${saveError}`
              : saving
                ? "جاري الحفظ..."
                : lastSavedAt
                  ? `تم الحفظ ${new Date(lastSavedAt).toLocaleTimeString("ar-SA")}`
                  : "لم يتم الحفظ بعد"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveNow()}
            disabled={saving}
            className="inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
          <Link
            href="/dashboard/properties"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-gray-200"
          >
            رجوع
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/70 p-5 dark:border-emerald-800/40 dark:bg-[#102318]">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">ملخص</div>
        <div className="mt-2 grid gap-2 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
          <div>عدد الشقق: {property.apartments_count || 0}</div>
          <div>عدد المحلات: {property.shops_count || 0}</div>
          <div>وحدات أخرى: {property.other_units_count || 0}</div>
          <div>النطاق: {property.unit_identifiers || "—"}</div>
          <div className="sm:col-span-2">
            إجمالي الإيجار/الإيرادات (حسب الوحدات):{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{totalUnitsRent.toLocaleString()} ر.س</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {units.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-emerald-800/40 dark:bg-[#1a3528]">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <p className="text-sm text-gray-500 dark:text-gray-400">جاري توليد الوحدات...</p>
          </div>
        ) : null}
        {units.map((unit) => (
          <details
            key={unit.id}
            className="group rounded-2xl border border-gray-200 bg-white p-4 dark:border-emerald-800/40 dark:bg-[#1a3528]"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{unit.label}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {unit.unitType === "shop"
                    ? `مساحات عمل: ${unit.defaults.livingRooms} · حمامات: ${unit.defaults.bathrooms}`
                    : `صالونات: ${unit.defaults.livingRooms} · غرف نوم: ${unit.defaults.bedrooms} · حمامات: ${unit.defaults.bathrooms}`}
                  {unit.unitType !== "shop" && unit.defaults.hasBalcony ? " · بلكونة" : ""}{" "}
                  {unit.unitType !== "shop" && unit.defaults.hasKitchen ? " · مطبخ" : ""}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 transition group-open:rotate-180 dark:text-gray-400" />
            </summary>

            <div className="mt-4 grid gap-4 sm:grid-cols-5">
              <div className="sm:col-span-2">
                <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">سعر/إيجار الوحدة (ر.س)</label>
                <input
                  type="number"
                  min={0}
                  value={unit.priceSar ?? 0}
                  onChange={(e) => updateUnitPrice(unit.id, Number(e.target.value || 0))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {unit.unitType === "shop" ? "مساحات عمل" : "صالونات"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={unit.defaults.livingRooms}
                  onChange={(e) => updateUnitDefaults(unit.id, { livingRooms: Number(e.target.value || 0) })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                />
              </div>
              {unit.unitType !== "shop" ? (
                <div>
                  <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">غرف نوم</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={unit.defaults.bedrooms}
                    onChange={(e) => updateUnitDefaults(unit.id, { bedrooms: Number(e.target.value || 0) })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">حمامات</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={unit.defaults.bathrooms}
                  onChange={(e) => updateUnitDefaults(unit.id, { bathrooms: Number(e.target.value || 0) })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#102318] dark:text-white"
                />
              </div>
              {unit.unitType !== "shop" ? (
                <>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={unit.defaults.hasKitchen}
                        onChange={(e) => updateUnitDefaults(unit.id, { hasKitchen: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 dark:border-emerald-800/50 dark:bg-[#102318]"
                      />
                      مطبخ
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={unit.defaults.hasBalcony}
                        onChange={(e) => updateUnitDefaults(unit.id, { hasBalcony: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 dark:border-emerald-800/50 dark:bg-[#102318]"
                      />
                      بلكونة
                    </label>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => regenerateUnit(unit.id)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#102318] dark:text-gray-200"
              >
                توليد المكوّنات
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {unit.components.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-emerald-800/40 dark:bg-[#102318]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.label}</p>
                    <button
                      type="button"
                      onClick={() => removeComponent(unit.id, c.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">المساحة (اختياري)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="0"
                          value={c.sizeM2 ?? ""}
                          onChange={(e) => updateComponent(unit.id, c.id, { sizeM2: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                        />
                        <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">م²</span>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">وصف (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: إطلالة/تشطيب/ملاحظات..."
                        value={c.description ?? ""}
                        onChange={(e) => updateComponent(unit.id, c.id, { description: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-600 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">صور</label>
                    <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center dark:border-emerald-800/50">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setComponentImages(unit.id, c.id, e.target.files)}
                        className="block w-full text-sm text-gray-600 file:me-0 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100 dark:text-gray-300 dark:file:bg-[#1a3528] dark:file:text-emerald-300 dark:hover:file:bg-[#102318]"
                      />
                    </div>
                    {c.images.some((img) => img.url) ? (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {c.images
                          .filter((img) => img.url)
                          .map((img) => (
                            <div
                              key={img.id}
                              className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-emerald-800/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.url!} alt="" className="h-16 w-full object-cover" />
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">لم يتم رفع صور بعد.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

