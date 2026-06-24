import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const OfficeSchema = schema({
  name: "Office",
  tableName: "offices",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    name: { type: "varchar", length: 255 },
    phone: { type: "varchar", length: 50, nullable: true },
    email: { type: "varchar", length: 255, nullable: true },
    address: { type: "text", nullable: true },
    license: { type: "varchar", length: 100, nullable: true },
    cr_number: { type: "varchar", length: 20, nullable: true },
    vat_number: { type: "varchar", length: 20, nullable: true },
    logo_url: { type: "varchar", length: 500, nullable: true },
    description_ar: { type: "varchar", length: 255, nullable: true },
    description_en: { type: "varchar", length: 255, nullable: true },
    is_active: { type: "boolean", default: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
});

export const OfficeOwnerLinkSchema = schema({
  name: "OfficeOwnerLink",
  tableName: "office_owner_links",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    office_id: { type: "uuid" },
    owner_id: { type: "uuid" },
    created_at: { type: "timestamp", createDate: true },
  },
});

export const OfficePropertyLinkSchema = schema({
  name: "OfficePropertyLink",
  tableName: "office_property_links",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    office_id: { type: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid" },
    commission_percent: { type: "numeric", precision: 5, scale: 2, nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
});
