import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const UnitSchema = schema({
  name: "Unit",
  tableName: "units",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    property_id: { type: "uuid" },
    owner_id: { type: "uuid" },
    label: { type: "varchar", length: 100 },
    unit_type: { type: "varchar", length: 50, nullable: true },
    floor: { type: "varchar", length: 50, nullable: true },
    area_sqm: { type: "numeric", precision: 10, scale: 2, nullable: true },
    rent_amount: { type: "numeric", precision: 14, scale: 2, nullable: true },
    status: { type: "varchar", length: 50, default: "vacant" },
    last_ac_service_date: { type: "date", nullable: true },
    last_plumbing_check_date: { type: "date", nullable: true },
    last_electrical_check_date: { type: "date", nullable: true },
    maintenance_risk_score: { type: "int", default: 0 },
    maintenance_risk_level: { type: "varchar", length: 50, default: "low" },
    description: { type: "text", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" } },
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
  },
});
