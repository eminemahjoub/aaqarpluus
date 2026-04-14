import { z } from "zod";

export const SaudiPhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ""))
  .refine((s) => /^05\d{8}$/.test(s) || /^\+9665\d{8}$/.test(s), {
    message: "رقم الجوال غير صحيح",
  })
  .transform((s) => (/^05\d{8}$/.test(s) ? `+966${s.substring(1)}` : s));

export const EmailSchema = z.string().trim().toLowerCase().email();

export const UuidSchema = z.string().uuid();

export const CommissionPercentSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, { message: "نسبة العمولة غير صحيحة" });

export function badZod(error: z.ZodError) {
  // Keep it simple for UI: first issue message
  const first = error.issues?.[0]?.message ?? "بيانات غير صحيحة";
  return first;
}

