import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const UserSchema = schema({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    email: { type: "varchar", length: 255, unique: true },
    password_hash: { type: "varchar", length: 255 },
    full_name: { type: "varchar", length: 255, nullable: true },
    phone: { type: "varchar", length: 50, nullable: true },
    id_number: { type: "varchar", length: 50, nullable: true },
    user_type: { type: "varchar", length: 50, default: "owner" },
    is_active: { type: "boolean", default: true },
    token_version: { type: "int", default: 0 },
    office_id: { type: "uuid", nullable: true },
    created_by_agency_id: { type: "uuid", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
});
