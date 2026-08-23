import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const TaskSchema = schema({
  name: "Task",
  tableName: "tasks",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    contact_id: { type: "uuid", nullable: true },
    tenant_id: { type: "uuid", nullable: true },
    type: { type: "varchar", length: 50, default: "task" },
    title: { type: "varchar", length: 255 },
    description: { type: "text", nullable: true },
    due_date: { type: "date", nullable: true },
    due_date_hijri: { type: "varchar", length: 20, nullable: true },
    status: { type: "varchar", length: 50, default: "pending" },
    priority: { type: "varchar", length: 50, default: "medium" },
    cost_sar: { type: "numeric", precision: 14, scale: 2, default: 0 },
    assigned_to: { type: "uuid", nullable: true },
    sla_deadline: { type: "timestamptz", nullable: true },
    materials_cost: { type: "numeric", precision: 12, scale: 2, default: 0 },
    materials: { type: "jsonb", default: () => "'[]'::jsonb" },
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
    tenant: { type: "many-to-one", target: "Contact", joinColumn: { name: "tenant_id" }, nullable: true },
    assignedTo: { type: "many-to-one", target: "User", joinColumn: { name: "assigned_to" }, nullable: true },
  },
});
