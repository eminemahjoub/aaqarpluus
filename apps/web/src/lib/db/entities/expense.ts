import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const ExpenseSchema = schema({
  name: "Expense",
  tableName: "expenses",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    related_revenue_id: { type: "uuid", nullable: true },
    contact_id: { type: "uuid", nullable: true },
    type: { type: "varchar", length: 100, nullable: true },
    amount_sar: { type: "numeric", precision: 14, scale: 2 },
    payment_method: { type: "varchar", length: 100, nullable: true },
    paid_at: { type: "timestamp", nullable: true },
    description: { type: "text", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
    contact: { type: "many-to-one", target: "Contact", joinColumn: { name: "contact_id" }, nullable: true },
  },
});
