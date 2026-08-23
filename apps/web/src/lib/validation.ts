import { z } from "zod";
import { AppError } from "@/lib/errors";

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

/**
 * AppError with the standard API validation shape:
 * 400 { error: "Validation failed", details: [{ path, message }, ...] }
 */
export function validationFailed(error: z.ZodError): AppError {
  const details = error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return new AppError({
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details,
  });
}

