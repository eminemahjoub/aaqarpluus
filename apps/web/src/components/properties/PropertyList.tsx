"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { useProperties, type Property } from "@/app/dashboard/properties/hooks/useProperties";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "green",
  vacant: "gray",
  sold: "blue",
};

const STATUS_AR: Record<string, string> = {
  active: "نشط",
  vacant: "شاغر",
  sold: "مباع",
};

export function PropertyList({
  officeId,
  onSelect,
  onAdd,
}: {
  officeId: string;
  onSelect: (property: Property) => void;
  onAdd?: () => void;
}) {
  const { data, isLoading, isError } = useProperties(officeId);
  const [query, setQuery] = useState("");

  const properties = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const q = query.trim();
    if (!q) return list;
    return list.filter((p) =>
      [p.title, p.name, p.city, p.neighborhood, p.region]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
    );
  }, [data, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو المدينة..."
            className="pr-9"
          />
        </div>
        {onAdd && (
          <Button type="button" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            إضافة عقار
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-500">
            تعذر تحميل العقارات
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && properties.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Building2 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد عقارات</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && properties.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="text-right"
            >
              <Card className="h-full cursor-pointer transition-colors hover:border-emerald-500">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {p.title ?? p.name ?? "—"}
                    </h3>
                    {p.status && (
                      <Badge variant={STATUS_VARIANT[p.status] ?? "amber"}>
                        {STATUS_AR[p.status] ?? p.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {[p.city, p.neighborhood].filter(Boolean).join(" — ") || "—"}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {p.units_count != null && <span>{p.units_count} وحدة</span>}
                    {p.floors_count != null && <span>{p.floors_count} دور</span>}
                    {p.area_m2 != null && <span>{p.area_m2} م²</span>}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}