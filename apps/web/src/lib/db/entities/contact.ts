import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const ContactSchema = schema({
  name: "Contact",
  tableName: "contacts",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    name: { type: "varchar", length: 255 },
    phone: { type: "varchar", length: 50, nullable: true, unique: true },
    alternative_phone: { type: "varchar", length: 50, nullable: true },
    email: { type: "varchar", length: 255, nullable: true, unique: true },
    type: { type: "varchar", length: 50, default: "tenant" },
    sex: { type: "varchar", length: 20, nullable: true },
    id_number: { type: "varchar", length: 50, nullable: true, unique: true },
    pin_hash: { type: "varchar", length: 255, nullable: true },
    status: { type: "varchar", length: 50, default: "active" },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  uniques: [
    { name: "UQ_contact_email", columns: ["email"] },
  ],
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
  },
});
