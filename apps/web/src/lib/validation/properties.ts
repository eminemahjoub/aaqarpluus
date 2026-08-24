import { z } from "zod";

export const PROPERTY_TYPES = [
  { value: "residential", label: "سكني" },
  { value: "commercial", label: "تجاري" },
  { value: "mixed", label: "متعدد" },
] as const;

export const PROPERTY_CONDITIONS = [
  { value: "new", label: "جديد" },
  { value: "good", label: "جيد" },
  { value: "fair", label: "مقبول" },
  { value: "needs_work", label: "يحتاج صيانة" },
] as const;

export const ZATCA_TAX_CATEGORIES = [
  { value: "S", label: "خاضع للضريبة (S)" },
  { value: "Z", label: "نسبة صفر (Z)" },
  { value: "O", label: "خارج النطاق (O)" },
  { value: "EX", label: "معفى (EX)" },
] as const;

/** رقم الصك — numeric, 6-12 digits (standard Saudi deed number shape). */
export const deedNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "رقم الصك يجب أن يكون رقماً من 6 إلى 12 خانة");

export const propertyTypeSchema = z.enum(["residential", "commercial", "mixed"]);

export const ejarNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6,15}$/, "رقم تسجيل إيجار يجب أن يكون رقماً")
  .optional()
  .or(z.literal(""));

export const commissionSchema = z
  .number()
  .min(0, "العمولة لا تقل عن 0%")
  .max(10, "العمولة لا تزيد عن 10%");

/** Account numbers — digits only, 8-12 chars, auto-stripped of spaces/dashes. */
export function accountNumberSchema(label: string) {
  return z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s\-]/g, ""))
    .refine((s) => s === "" || /^\d{8,12}$/.test(s), {
      message: `${label} يجب أن يكون رقماً من 8 إلى 12 خانة`,
    });
}