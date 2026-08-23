"use client";

import { useQuery } from "@tanstack/react-query";
import {
  X,
  Home,
  Image as ImageIcon,
  FileText,
  Wallet,
  Receipt,
  Plus,
  Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import {
  useProperty,
  type Property,
  type PropertyImage,
  type Unit,
} from "@/app/dashboard/properties/hooks/useProperties";

/**
 * Property detail drawer (Day 4 extraction).
 * View-only: renders the property detail via useProperty(propertyId);
 * interactions (add unit / upload image / edit) are delegated to the parent
 * through optional callbacks. Images are lazy-loaded from the dedicated
 * /api/property-images endpoint.
 */

const UNIT_TYPE_AR: Record<string, string> = {
  apartment: "شقة",
  shop: "محل",
  other: "أخرى",
};

function propertyStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "active":
      return "green";
    case "vacant":
      return "gray";
    case "sold":
      return "blue";
    default:
      return "amber";
  }
}

const STATUS_AR: Record<string, string> = {
  active: "نشط",
  vacant: "شاغر",
  sold: "مباع",
};

function unitStatusVariant(status: string): BadgeVariant {
  return status === "occupied" ? "green" : "gray";
}

function fmtMoney(v: number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ar-SA")} ر.س`;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ar-SA");
}

function usePropertyImages(propertyId: string) {
  return useQuery<PropertyImage[]>({
    queryKey: ["property-images", propertyId],
    queryFn: async () => {
      const res = await authFetch(`/api/property-images?property_id=${encodeURIComponent(propertyId)}`);
      if (!res.ok) throw new Error("فشل تحميل الصور");
      return res.json();
    },
    enabled: Boolean(propertyId),
  });
}

function LoadingDetail() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-16" />
    </div>
  );
}

function UnitsSection({ units, onAddUnit }: { units: Unit[]; onAddUnit?: (propertyId: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">الوحدات ({units.length})</h3>
        {onAddUnit && (
          <Button type="button" variant="outline" size="sm" onClick={() => onAddUnit("")}>
            <Plus className="h-4 w-4" />
            إضافة وحدة
          </Button>
        )}
      </div>
      {units.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">لا توجد وحدات</p>
      )}
      {units.map((u) => (
        <Card key={u.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="space-y-0.5">
              <p className="font-medium text-gray-900 dark:text-white">{u.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {UNIT_TYPE_AR[u.unit_type] ?? u.unit_type}
                {u.floor ? ` — الدور ${u.floor}` : ""}
                {u.area_sqm ? ` — ${u.area_sqm} م²` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {fmtMoney(u.rent_amount)}
              </span>
              <Badge variant={unitStatusVariant(u.status)}>
                {u.status === "occupied" ? "مأهولة" : "شاغرة"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ImagesSection({
  images,
  onUploadImages,
}: {
  images?: PropertyImage[];
  onUploadImages?: (propertyId: string) => void;
}) {
  const list = Array.isArray(images) ? images : [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">الصور ({list.length})</h3>
        {onUploadImages && (
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            إضافة صور
          </Button>
        )}
      </div>
      {list.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">لا توجد صور</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {list.map((img) => (
          <img
            key={img.id}
            src={img.public_url}
            alt=""
            className="aspect-square w-full rounded-lg object-cover"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}

export function PropertyDetailDrawer({
  propertyId,
  open,
  onClose,
  onEdit,
  onAddUnit,
  onUploadImages,
}: {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onEdit?: (property: Property) => void;
  onAddUnit?: (propertyId: string) => void;
  onUploadImages?: (propertyId: string) => void;
}) {
  const { data: property, isLoading, isError } = useProperty(open ? propertyId : "");
  const { data: images } = usePropertyImages(open ? propertyId : "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
        {isLoading && <LoadingDetail />}

        {!isLoading && isError && (
          <p className="py-8 text-center text-sm text-red-500">تعذر تحميل تفاصيل العقار</p>
        )}

        {!isLoading && !isError && property && (
          <>
            <DialogHeader className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <DialogTitle>{property.title ?? property.name ?? "—"}</DialogTitle>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {property.city && <span>{property.city}</span>}
                  {property.neighborhood && <span>— {property.neighborhood}</span>}
                  {property.status && (
                    <Badge variant={propertyStatusVariant(property.status)}>
                      {STATUS_AR[property.status] ?? property.status}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(property)}>
                    <Pencil className="h-4 w-4" />
                    تحرير
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>

            <Tabs defaultValue="units">
              <TabsList>
                <TabsTrigger value="units">
                  <Home className="h-4 w-4" />
                  الوحدات
                </TabsTrigger>
                <TabsTrigger value="images">
                  <ImageIcon className="h-4 w-4" />
                  الصور
                </TabsTrigger>
                <TabsTrigger value="contracts">
                  <FileText className="h-4 w-4" />
                  العقد
                </TabsTrigger>
                <TabsTrigger value="expenses">
                  <Wallet className="h-4 w-4" />
                  المصروفات
                </TabsTrigger>
                <TabsTrigger value="revenues">
                  <Receipt className="h-4 w-4" />
                  الإيرادات
                </TabsTrigger>
              </TabsList>

              <TabsContent value="units">
                <UnitsSection units={Array.isArray(property.units) ? property.units : []} onAddUnit={onAddUnit} />
              </TabsContent>

              <TabsContent value="images">
                <ImagesSection images={images} onUploadImages={onUploadImages} />
              </TabsContent>

              <TabsContent value="contracts">
                <ActiveContractSection contracts={Array.isArray(property.contracts) ? property.contracts : []} />
              </TabsContent>

              <TabsContent value="expenses">
                <MoneyListSection
                  title="المصروفات"
                  empty="لا توجد مصروفات"
                  rows={Array.isArray(property.expenses) ? property.expenses : []}
                  dateField="paid_at"
                />
              </TabsContent>

              <TabsContent value="revenues">
                <MoneyListSection
                  title="الإيرادات"
                  empty="لا توجد إيرادات"
                  rows={Array.isArray(property.revenues) ? property.revenues : []}
                  dateField="received_at"
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActiveContractSection({ contracts }: { contracts: any[] }) {
  const active = contracts.find((c: any) => c.status === "active");
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">العقد النشط</h3>
      {!active && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            لا يوجد عقد نشط
          </CardContent>
        </Card>
      )}
      {active && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">المستأجر</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {active.contact?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">الفترة</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {fmtDate(active.start_date)} ← {fmtDate(active.end_date)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">الإيجار الإجمالي</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {fmtMoney(active.rent_total_sar)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">التكرار</span>
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {active.payment_frequency ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MoneyListSection({
  title,
  empty,
  rows,
  dateField,
}: {
  title: string;
  empty: string;
  rows: any[];
  dateField: "paid_at" | "received_at";
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">{empty}</p>
      )}
      {rows.map((r) => (
        <div
          key={r.id}
          className={cn(
            "flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.type ?? "—"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(r[dateField])}</p>
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {fmtMoney(r.amount_sar)}
          </span>
        </div>
      ))}
    </div>
  );
}