"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const schema = z.object({
  name: z.string().trim().min(1, "اسم المبنى مطلوب"),
  address: z.string().trim().min(1, "العنوان مطلوب"),
  floors_count: z.number().int().min(1, "الحد الأدنى طابق واحد"),
  apartments_per_floor: z.number().int().min(0, "0 كحد أدنى"),
  shops_count: z.number().int().min(0, "0 كحد أدنى"),
  shops_per_floor: z.boolean(),
  property_model_type: z.enum(["residential", "commercial", "mixed"]),
  owner_id: z.string().optional(),
});

export type BuildingFormData = z.infer<typeof schema>;

export type OwnerOption = { id: string; full_name: string | null; email: string };

type Props = {
  onSubmit: (data: BuildingFormData) => void;
  isSubmitting?: boolean;
};

export default function CreateBuildingForm({ onSubmit, isSubmitting }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BuildingFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      floors_count: 1,
      apartments_per_floor: 0,
      shops_count: 0,
      shops_per_floor: false,
      property_model_type: "residential" as const,
    },
  });

  const [owners, setOwners] = React.useState<OwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = React.useState(false);

  React.useEffect(() => {
    setOwnersLoading(true);
    authFetch("/api/offices/owners")
      .then((r: Response) => (r.ok ? r.json() : []))
      .then((data: unknown) => setOwners(Array.isArray(data) ? (data as OwnerOption[]) : []))
      .catch(() => setOwners([]))
      .finally(() => setOwnersLoading(false));
  }, []);

  const floors = watch("floors_count") || 1;
  const aptPerFloor = watch("apartments_per_floor") || 0;
  const shops = watch("shops_count") || 0;
  const shopsPerFloor = watch("shops_per_floor");
  const totalApt = floors * aptPerFloor;
  const totalShops = shopsPerFloor ? shops * floors : shops;
  const totalUnits = totalApt + totalShops;

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const errorClass = "mt-1 text-xs text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>اسم المبنى</label>
          <input type="text" {...register("name")} className={inputClass} placeholder="برج النخيل" />
          {errors.name ? <p className={errorClass}>{errors.name.message}</p> : null}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>العنوان</label>
          <input type="text" {...register("address")} className={inputClass} placeholder="حي الروضة، الرياض" />
          {errors.address ? <p className={errorClass}>{errors.address.message}</p> : null}
        </div>

        <div>
          <label className={labelClass}>عدد الطوابق</label>
          <input type="number" min={1} {...register("floors_count")} className={inputClass} />
          {errors.floors_count ? <p className={errorClass}>{errors.floors_count.message}</p> : null}
        </div>

        <div>
          <label className={labelClass}>شقة لكل طابق</label>
          <input type="number" min={0} {...register("apartments_per_floor")} className={inputClass} />
          {errors.apartments_per_floor ? <p className={errorClass}>{errors.apartments_per_floor.message}</p> : null}
        </div>

        <div>
          <label className={labelClass}>عدد المحلات</label>
          <input type="number" min={0} {...register("shops_count")} className={inputClass} />
          {errors.shops_count ? <p className={errorClass}>{errors.shops_count.message}</p> : null}
        </div>

        <div className="flex items-end gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" {...register("shops_per_floor")} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            محل لكل طابق
          </label>
        </div>

        <div>
          <label className={labelClass}>نوع العقار</label>
          <select {...register("property_model_type")} className={inputClass}>
            <option value="residential">سكني</option>
            <option value="commercial">تجاري</option>
            <option value="mixed">مختلط</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>المالك (اختياري)</label>
          <select {...register("owner_id")} className={inputClass} disabled={ownersLoading}>
            <option value="">— بدون مالك محدد —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name ?? o.email}
              </option>
            ))}
          </select>
          {ownersLoading ? <p className="mt-1 text-xs text-gray-500">جاري التحميل...</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-900/20 dark:text-emerald-200">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>
            سيتم إنشاء <strong>{totalUnits}</strong> وحدة: <strong>{totalApt}</strong> شقة +{" "}
            <strong>{totalShops}</strong> محل
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {isSubmitting ? "جاري الإنشاء..." : "إنشاء المبنى وتوليد الوحدات"}
        </button>
      </div>
    </form>
  );
}
