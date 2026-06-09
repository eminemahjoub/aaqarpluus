"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authFetch } from "@/lib/auth-fetch";

const schema = z.object({
  firstName: z.string().trim().min(1, "الاسم مطلوب"),
  lastName: z.string().trim().min(1, "اسم العائلة مطلوب"),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  phone: z
    .string()
    .trim()
    .refine((s) => {
      const p = s.replace(/\s+/g, "");
      return /^05\d{8}$/.test(p) || /^\+9665\d{8}$/.test(p);
    }, { message: "رقم الجوال غير صحيح (مثال: 05xxxxxxxx)" }),
  idNumber: z.string().trim().min(1, "رقم الهوية / البطاقة الوطنية مطلوب"),
});

type FormData = z.infer<typeof schema>;

export type CreatedOwner = {
  link_id: string | null;
  owner_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
};

type Props = {
  onSuccess?: (row: CreatedOwner) => void;
  onError?: (message: string) => void;
};

export default function CreateOwnerForm({ onSuccess, onError }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormData) {
    const res = await authFetch("/api/offices/owners/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const text = await res.clone().text().catch(() => "");
      const j = await res.json().catch(() => null);
      console.error("[CreateOwnerForm] API error:", res.status, "raw:", text, "json:", j);
      const msg = j?.error ?? text ?? "تعذّر إنشاء المالك";
      onError?.(msg);
      return;
    }
    const data = (await res.json()) as CreatedOwner;
    reset();
    onSuccess?.(data);
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const errorClass = "mt-1 text-xs text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>الاسم</label>
          <input type="text" {...register("firstName")} className={inputClass} placeholder="محمد" />
          {errors.firstName ? <p className={errorClass}>{errors.firstName.message}</p> : null}
        </div>
        <div>
          <label className={labelClass}>اسم العائلة</label>
          <input type="text" {...register("lastName")} className={inputClass} placeholder="الفلاني" />
          {errors.lastName ? <p className={errorClass}>{errors.lastName.message}</p> : null}
        </div>
        <div>
          <label className={labelClass}>البريد الإلكتروني</label>
          <input type="email" dir="ltr" {...register("email")} className={`${inputClass} text-left`} placeholder="owner@example.com" />
          {errors.email ? <p className={errorClass}>{errors.email.message}</p> : null}
        </div>
        <div>
          <label className={labelClass}>كلمة المرور</label>
          <input type="password" dir="ltr" {...register("password")} className={`${inputClass} text-left`} placeholder="••••••" />
          {errors.password ? <p className={errorClass}>{errors.password.message}</p> : null}
        </div>
        <div>
          <label className={labelClass}>رقم الجوال</label>
          <input type="tel" dir="ltr" {...register("phone")} className={`${inputClass} text-left`} placeholder="05xxxxxxxx" />
          {errors.phone ? <p className={errorClass}>{errors.phone.message}</p> : null}
        </div>
        <div>
          <label className={labelClass}>رقم الهوية / البطاقة الوطنية</label>
          <input type="text" dir="ltr" {...register("idNumber")} className={`${inputClass} text-left`} placeholder="1234567890" />
          {errors.idNumber ? <p className={errorClass}>{errors.idNumber.message}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {isSubmitting ? "جاري الإنشاء..." : "Créer le compte propriétaire"}
        </button>
      </div>
    </form>
  );
}
