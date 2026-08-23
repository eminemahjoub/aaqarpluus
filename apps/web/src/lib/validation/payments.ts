import { z } from "zod";

/**
 * Shared payment validation schemas.
 * payment_method mirrors the migration 006 enum on contract_payments
 * (cash | bank_transfer | check | card | other); "cash" is the default.
 */
export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "check", "card", "other"]);
