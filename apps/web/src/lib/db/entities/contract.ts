import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const ContractSchema = schema({
  name: "Contract",
  tableName: "contracts",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    contact_id: { type: "uuid", nullable: true },
    start_date: { type: "date", nullable: true },
    end_date: { type: "date", nullable: true },
    rent_total_sar: { type: "numeric", precision: 14, scale: 2, nullable: true },
    rent_amount_sar: { type: "numeric", precision: 14, scale: 2, nullable: true },
    payment_frequency: { type: "varchar", length: 50, nullable: true },
    installments_count: { type: "int", nullable: true },
    status: { type: "varchar", length: 50, default: "active" },
    notes: { type: "text", nullable: true },
    extra: { type: "jsonb", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
    contact: { type: "many-to-one", target: "Contact", joinColumn: { name: "contact_id" }, nullable: true },
  },
});
