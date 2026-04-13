import { DataSource } from "typeorm";
import {
  UserSchema,
  OfficeSchema,
  OfficeOwnerLinkSchema,
  OfficePropertyLinkSchema,
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
} from "./entities";

let dataSource: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;

  dataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASS ?? "postgres",
    database: process.env.DB_NAME ?? "property_crm",
    ssl: false,
    synchronize: true,
    logging: process.env.NODE_ENV === "development" ? ["error"] : false,
    entities: [
      UserSchema,
      OfficeSchema,
      OfficeOwnerLinkSchema,
      OfficePropertyLinkSchema,
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
    ],
  });

  await dataSource.initialize();
  return dataSource;
}
