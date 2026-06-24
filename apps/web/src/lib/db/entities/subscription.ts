import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export const SubscriptionSchema = schema({
  name: "Subscription",
  tableName: "subscriptions",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    user_id: { type: "uuid" },
    plan: { type: "varchar", length: 30, default: "free" }, // free|basic|premium|enterprise
    status: { type: "varchar", length: 30, default: "active" }, // active|expired|cancelled|trial
    start_date: { type: "date" },
    end_date: { type: "date", nullable: true },
    max_properties: { type: "int", default: 5 },
    max_units: { type: "int", default: 20 },
    max_users: { type: "int", default: 1 },
    price: { type: "numeric", precision: 10, scale: 2, default: 0 },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" } },
  },
});
