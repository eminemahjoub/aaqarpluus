import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const PropertySchema = schema({
  name: "Property",
  tableName: "properties",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    managing_office_id: { type: "uuid", nullable: true },
    created_by_agency_id: { type: "uuid", nullable: true },
    name: { type: "varchar", length: 255 },
    title: { type: "varchar", length: 255, nullable: true },
    status: { type: "varchar", length: 50, default: "vacant" },
    property_model_type: { type: "varchar", length: 100, nullable: true },
    region: { type: "varchar", length: 100, nullable: true },
    city: { type: "varchar", length: 100, nullable: true },
    neighborhood: { type: "varchar", length: 100, nullable: true },
    address: { type: "text", nullable: true },
    latitude: { type: "numeric", precision: 10, scale: 7, nullable: true },
    longitude: { type: "numeric", precision: 10, scale: 7, nullable: true },
    area_m2: { type: "numeric", precision: 10, scale: 2, nullable: true },
    property_cost: { type: "numeric", precision: 14, scale: 2, nullable: true },
    floors_count: { type: "int", default: 0 },
    units_count: { type: "int", default: 0 },
    apartments_count: { type: "int", default: 0 },
    shops_count: { type: "int", default: 0 },
    other_units_count: { type: "int", default: 0 },
    unit_identifiers: { type: "varchar", length: 255, nullable: true },
    title_deed_number: { type: "varchar", length: 100, nullable: true },
    water_account: { type: "varchar", length: 100, nullable: true },
    electricity_account: { type: "varchar", length: 100, nullable: true },
    description: { type: "text", nullable: true },
    payment_frequency: { type: "varchar", length: 50, nullable: true },
    lessor_type: { type: "varchar", length: 20, nullable: true },
    lessor_contact_id: { type: "uuid", nullable: true },
    commission_percent: { type: "numeric", precision: 5, scale: 2, nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
  },
});
