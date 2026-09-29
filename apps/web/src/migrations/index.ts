import type { MigrationInterface } from "typeorm";
import { FinancialAndMaintenance20260625000000 } from "@/migrations/20260625000000FinancialAndMaintenance";
import { AddContactPinPlain20260626000000 } from "@/migrations/20260626000000AddContactPinPlain";
import { AddContactUniqueConstraints20260627000000 } from "@/migrations/20260627000000AddContactUniqueConstraints";
import { AddRevenuePaymentId20260629000000 } from "@/migrations/20260629000000AddRevenuePaymentId";
import { AddMaintenancePredictionFields20260809000004 } from "@/migrations/20260809000004AddMaintenancePredictionFields";
import { DropContactPinPlain20260929000000 } from "@/migrations/20260929000000DropContactPinPlain";

/**
 * Ordered list of every TypeORM migration — the single source of truth used by
 * both the runtime DataSource and scripts/gen-ts-migrations-sql.ts (which
 * renders migrations/ts_migrations_combined.sql for psql-based prod deploys).
 * Append new migrations here only.
 */
export const ALL_MIGRATIONS: Array<new () => MigrationInterface> = [
  FinancialAndMaintenance20260625000000,
  AddContactPinPlain20260626000000,
  AddContactUniqueConstraints20260627000000,
  AddRevenuePaymentId20260629000000,
  AddMaintenancePredictionFields20260809000004,
  DropContactPinPlain20260929000000,
];
