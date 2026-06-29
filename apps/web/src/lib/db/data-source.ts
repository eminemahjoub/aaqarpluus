import { DataSource } from "typeorm";
import {
  UserSchema,
  OfficeSchema,
  OfficeOwnerLinkSchema,
  OfficePropertyLinkSchema,
  SubscriptionSchema,
  AuditLogSchema,
  PlatformSettingSchema,
  ConversationSchema,
  ConversationParticipantSchema,
  MessageSchema,
  MessageNotificationSchema,
  PropertySchema,
  UnitSchema,
  ContactSchema,
  ContractSchema,
  ContractPaymentSchema,
  TaskSchema,
  DocumentSchema,
  RevenueSchema,
  ExpenseSchema,
  PropertyImageSchema,
  NotificationSchema,
} from "./entities";
import { FinancialAndMaintenance20260625000000 } from "@/migrations/20260625000000FinancialAndMaintenance";
import { AddContactPinPlain20260626000000 } from "@/migrations/20260626000000AddContactPinPlain";
import { AddContactUniqueConstraints20260627000000 } from "@/migrations/20260627000000AddContactUniqueConstraints";
import { AddRevenuePaymentId20260629000000 } from "@/migrations/20260629000000AddRevenuePaymentId";

let dataSource: DataSource | null = null;
let initPromise: Promise<DataSource> | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;

  if (!initPromise) {
    initPromise = (async () => {
      dataSource = new DataSource({
        type: "postgres",
        host: process.env.DB_HOST ?? "127.0.0.1",
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? "postgres",
        password: process.env.DB_PASS ?? "postgres",
        database: process.env.DB_NAME ?? "property_crm",
        ssl: false,
        synchronize: process.env.DB_SYNCHRONIZE === "true",
        logging: process.env.NODE_ENV === "development" ? ["error"] : false,
        migrations: [FinancialAndMaintenance20260625000000, AddContactPinPlain20260626000000, AddContactUniqueConstraints20260627000000, AddRevenuePaymentId20260629000000],
        entities: [
          UserSchema,
          OfficeSchema,
          OfficeOwnerLinkSchema,
          OfficePropertyLinkSchema,
          SubscriptionSchema,
          AuditLogSchema,
          PlatformSettingSchema,
          ConversationSchema,
          ConversationParticipantSchema,
          MessageSchema,
          MessageNotificationSchema,
          PropertySchema,
          UnitSchema,
          ContactSchema,
          ContractSchema,
          ContractPaymentSchema,
          TaskSchema,
          DocumentSchema,
          RevenueSchema,
          ExpenseSchema,
          PropertyImageSchema,
          NotificationSchema,
        ],
      });

      await dataSource.initialize();
      return dataSource;
    })();
  }

  return initPromise;
}
