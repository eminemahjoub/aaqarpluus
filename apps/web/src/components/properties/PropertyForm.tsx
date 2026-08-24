"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";

const propertySchema = z.object({
  owner_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
  region: z.string().optional(),
  city: z.string().min(2, "المدينة مطلوبة"),
  neighborhood: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  area_m2: z.number().positive().optional(),
  floors_count: z.number().int().positive().optional(),
  apartments_count: z.number().int().min(0).optional(),
  shops_count: z.number().int().min(0).optional(),
  other_units_count: z.number().int().min(0).optional(),
  payment_frequency: z.enum(["monthly", "quarterly", "biannual", "annual"]),
  lessor_type: z.string().optional(),
  commission_percent: z.number().min(0).max(100).optional(),
  water_account: z.string().optional(),
  electricity_account: z.string().optional(),
  title_deed_number: z.string().optional(),
  description: z.string().optional(),
});

export type PropertyFormData = z.infer<typeof propertySchema>;

type LinkedOwner = {
  owner_id: string;
  full_name: string | null;
  email: string | null;
};

interface PropertyFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PropertyFormData) => void;
  initialData?: Partial<PropertyFormData>;
  isSubmitting?: boolean;
  /** agency → show linked-owner selector (office_owner_links) */
  userType?: string;
}

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "biannual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

export function PropertyForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  userType,
}: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    if (open) reset(initialData);
  }, [open, initialData, reset]);

  const isAgency = userType === "agency";
  const { data: owners } = useQuery<LinkedOwner[]>({
    queryKey: ["office-owners"],
    queryFn: async () => {
      const res = await authFetch("/api/offices/owners");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && isAgency,
  });

  const isEdit = !!initialData?.title;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تحديث عقار" : "إضافة عقار"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isAgency && (
            <div>
              <Label>المالك *</Label>
              <select
                {...register("owner_id")}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                defaultValue=""
              >
                <option value="">اختر المالك</option>
                {(owners ?? []).map((o) => (
                  <option key={o.owner_id} value={o.owner_id}>
                    {o.full_name ?? o.email ?? o.owner_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>العنوان</Label>
            <Input {...register("title")} placeholder="عقار الرياض" />
            {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>المدينة *</Label>
              <Input {...register("city")} placeholder="الرياض" />
              {errors.city && <p className="text-sm text-red-500">{errors.city.message}</p>}
            </div>
            <div>
              <Label>المنطقة</Label>
              <Input {...register("region")} placeholder="الوسطى" />
            </div>
          </div>

          <div>
            <Label>الحي</Label>
            <Input {...register("neighborhood")} placeholder="الملز" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>خط العرض</Label>
              <Input
                type="number"
                step="any"
                {...register("latitude", { valueAsNumber: true })}
                placeholder="24.7136"
              />
            </div>
            <div>
              <Label>خط الطول</Label>
              <Input
                type="number"
                step="any"
                {...register("longitude", { valueAsNumber: true })}
                placeholder="46.6753"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>المساحة (م²)</Label>
              <Input
                type="number"
                {...register("area_m2", { valueAsNumber: true })}
                placeholder="500"
              />
            </div>
            <div>
              <Label>عدد الأدوار</Label>
              <Input
                type="number"
                {...register("floors_count", { valueAsNumber: true })}
                placeholder="5"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>شقق</Label>
              <Input
                type="number"
                min={0}
                {...register("apartments_count", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>محلات</Label>
              <Input
                type="number"
                min={0}
                {...register("shops_count", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>وحدات أخرى</Label>
              <Input
                type="number"
                min={0}
                {...register("other_units_count", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>تكرار الدفع *</Label>
              <select
                {...register("payment_frequency")}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                defaultValue="monthly"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>نوع المؤجر</Label>
              <Input {...register("lessor_type")} placeholder="مالك" />
            </div>
          </div>

          {isAgency && (
            <div>
              <Label>نسبة العمولة (%)</Label>
              <Input
                type="number"
                {...register("commission_percent", { valueAsNumber: true })}
                placeholder="2.5"
                min={0}
                max={100}
                step={0.1}
              />
              {errors.commission_percent && (
                <p className="text-sm text-red-500">يجب أن تكون بين 0 و 100</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>حساب المياه</Label>
              <Input {...register("water_account")} placeholder="123456" />
            </div>
            <div>
              <Label>حساب الكهرباء</Label>
              <Input {...register("electricity_account")} placeholder="789012" />
            </div>
          </div>

          <div>
            <Label>رقم الصك</Label>
            <Input {...register("title_deed_number")} placeholder="1012345678" />
          </div>

          <div>
            <Label>الوصف</Label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="وصف العقار..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-500 focus-visible:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "جاري الحفظ..." : isEdit ? "تحديث" : "إنشاء"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}