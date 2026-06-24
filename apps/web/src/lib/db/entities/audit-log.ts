import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const AuditLogSchema = schema({
  name: "AuditLog",
  tableName: "audit_logs",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    user_id: { type: "uuid", nullable: true },
    action: { type: "varchar", length: 50 },
    entity_type: { type: "varchar", length: 100, nullable: true },
    entity_id: { type: "varchar", length: 100, nullable: true },
    changes: { type: "jsonb", nullable: true },
    metadata: { type: "jsonb", nullable: true },
    ip_address: { type: "varchar", length: 80, nullable: true },
    user_agent: { type: "varchar", length: 500, nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
  relations: {
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" }, nullable: true },
  },
});
