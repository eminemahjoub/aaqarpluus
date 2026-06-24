import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const NotificationSchema = schema({
  name: "Notification",
  tableName: "notifications",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    user_id: { type: "uuid" },
    type: { type: "varchar", length: 50 },
    title: { type: "varchar", length: 255 },
    body: { type: "text", nullable: true },
    reference_id: { type: "uuid", nullable: true },
    reference_type: { type: "varchar", length: 50, nullable: true },
    is_read: { type: "boolean", default: false },
    created_at: { type: "timestamp", createDate: true },
  },
  indices: [
    { name: "idx_notif_user_read", columns: ["user_id", "is_read"] as string[] },
    { name: "idx_notif_reference", columns: ["reference_id", "reference_type"] as string[] },
  ],
  relations: {
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" } },
  },
});
