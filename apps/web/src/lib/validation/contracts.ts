import { z } from "zod";
import { UuidSchema } from "@/lib/validation";

/**
 * Shared contract validation schemas.
 *
 * Storage policy (Option A): payment_frequency is stored in English
 * (canonical: monthly | quarterly | biannual | annual | weekly | one_time),
 * matching existing contract rows and staying ZATCA/query-friendly. The
 * frontend sends Arabic values, so both languages are accepted on input and
 * mapped to English via frequencyToEnglish before persisting.
 */

export const contractNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .min(3, "رقم العقد يجب أن يكون 3 أحرف على الأقل")
      .max(50, "رقم العقد طويل جداً")
      .regex(/^[A-Z0-9\-\/]+$/, "يسمح فقط بالأحرف الإنجليزية الكبيرة والأرقام والشرطات")
  );

const ARABIC_FREQUENCIES = ["شهري", "ربع سنوي", "نصف سنوي", "سنوي", "أسبوعي", "دفعة واحدة"] as const;
const ENGLISH_FREQUENCIES = [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
  "weekly",
  "one_time",
] as const;

export const paymentFrequencySchema = z.enum([...ARABIC_FREQUENCIES, ...ENGLISH_FREQUENCIES]);

export function frequencyToEnglish(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const map: Record<string, string> = {
    "شهري": "monthly",
    "ربع سنوي": "quarterly",
    "نصف سنوي": "biannual",
    "سنوي": "annual",
    "أسبوعي": "weekly",
    "دفعة واحدة": "one_time",
  };
  return map[value] ?? value;
}

export function frequencyToArabic(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const map: Record<string, string> = {
    monthly: "شهري",
    quarterly: "ربع سنوي",
    biannual: "نصف سنوي",
    annual: "سنوي",
    weekly: "أسبوعي",
    one_time: "دفعة واحدة",
  };
  return map[value] ?? value;
}

export const contractSchema = z.object({
  contract_number: contractNumberSchema.optional().nullable(),
  property_id: UuidSchema,
  unit_id: UuidSchema.optional().nullable(),
  tenant_id: UuidSchema.optional().nullable(),
  contact_id: UuidSchema.optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  rent_amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر").optional(),
  rent_total_sar: z.number().positive("المبلغ يجب أن يكون أكبر من صفر").optional().nullable(),
  rent_amount_sar: z.number().positive("المبلغ يجب أن يكون أكبر من صفر").optional().nullable(),
  payment_frequency: paymentFrequencySchema.optional().nullable(),
  payment_period: paymentFrequencySchema.optional().nullable(),
  installments_count: z.number().int().min(1).optional().nullable(),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  extra: z.unknown().optional().nullable(),
  payments: z.array(z.unknown()).optional(),
});
