import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export { UserSchema } from "./user";
export { PropertySchema } from "./property";
export { ContactSchema } from "./contact";
export { ContractSchema } from "./contract";
export { NotificationSchema } from "./notification";
export { RevenueSchema } from "./revenue";
export { ExpenseSchema } from "./expense";
export { TaskSchema } from "./task";
export { OfficeSchema, OfficeOwnerLinkSchema, OfficePropertyLinkSchema } from "./office";
export { UnitSchema } from "./unit";
export { SubscriptionSchema } from "./subscription";
export { AuditLogSchema } from "./audit-log";

// Inline schemas below will be progressively extracted into per-entity files.

export const PlatformSettingSchema = schema({
  name: "PlatformSetting",
  tableName: "platform_settings",
  columns: {
    key: { type: "varchar", length: 100, primary: true },
    value: { type: "jsonb" },
    updated_by: { type: "varchar", length: 100, nullable: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
});

export const ConversationSchema = schema({
  name: "Conversation",
  tableName: "conversations",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    type: { type: "varchar", length: 30, default: "direct" }, // direct|property|unit|support
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    subject: { type: "varchar", length: 255, nullable: true },
    created_by: { type: "uuid" },
    is_archived: { type: "boolean", default: false },
    last_message_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
    creator: { type: "many-to-one", target: "User", joinColumn: { name: "created_by" } },
  },
});

export const ConversationParticipantSchema = schema({
  name: "ConversationParticipant",
  tableName: "conversation_participants",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    conversation_id: { type: "uuid" },
    user_id: { type: "uuid" },
    role: { type: "varchar", length: 30 }, // owner|agency|admin
    joined_at: { type: "timestamp", createDate: true },
    last_read_at: { type: "timestamp", nullable: true },
    is_muted: { type: "boolean", default: false },
  },
  indices: [
    { name: "idx_conv_participants_conv", columns: ["conversation_id"] as string[] },
    { name: "idx_conv_participants_user", columns: ["user_id"] as string[] },
    { name: "ux_conv_participants_conv_user", columns: ["conversation_id", "user_id"] as string[], unique: true },
  ],
  relations: {
    conversation: { type: "many-to-one", target: "Conversation", joinColumn: { name: "conversation_id" }, onDelete: "CASCADE" },
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" } },
  },
});

export const MessageSchema = schema({
  name: "Message",
  tableName: "messages",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    conversation_id: { type: "uuid" },
    sender_id: { type: "uuid" },
    content: { type: "text" },
    type: { type: "varchar", length: 20, default: "text" }, // text|image|file|system
    file_url: { type: "varchar", length: 1000, nullable: true },
    file_name: { type: "varchar", length: 255, nullable: true },
    file_size: { type: "int", nullable: true },
    file_type: { type: "varchar", length: 120, nullable: true },
    is_edited: { type: "boolean", default: false },
    edited_at: { type: "timestamp", nullable: true },
    is_deleted: { type: "boolean", default: false },
    read_by: { type: "jsonb", default: () => "'[]'::jsonb" },
    metadata: { type: "jsonb", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  indices: [
    { name: "idx_messages_conv_created", columns: ["conversation_id", "created_at"] as string[] },
  ],
  relations: {
    conversation: { type: "many-to-one", target: "Conversation", joinColumn: { name: "conversation_id" }, onDelete: "CASCADE" },
    sender: { type: "many-to-one", target: "User", joinColumn: { name: "sender_id" } },
  },
});

export const MessageNotificationSchema = schema({
  name: "MessageNotification",
  tableName: "message_notifications",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    user_id: { type: "uuid" },
    conversation_id: { type: "uuid" },
    message_id: { type: "uuid" },
    is_read: { type: "boolean", default: false },
    created_at: { type: "timestamp", createDate: true },
  },
  indices: [
    { name: "idx_msg_notif_user_read", columns: ["user_id", "is_read"] as string[] },
    { name: "idx_msg_notif_conv", columns: ["conversation_id"] as string[] },
  ],
  relations: {
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" } },
    conversation: { type: "many-to-one", target: "Conversation", joinColumn: { name: "conversation_id" }, onDelete: "CASCADE" },
    message: { type: "many-to-one", target: "Message", joinColumn: { name: "message_id" }, onDelete: "CASCADE" },
  },
});

export const ContractPaymentSchema = schema({
  name: "ContractPayment",
  tableName: "contract_payments",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    contract_id: { type: "uuid" },
    amount_sar: { type: "numeric", precision: 14, scale: 2 },
    due_date: { type: "date", nullable: true },
    paid_at: { type: "timestamp", nullable: true },
    status: { type: "varchar", length: 50, default: "pending" },
    payment_method: { type: "varchar", length: 50, default: "cash" },
    notes: { type: "text", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    contract: { type: "many-to-one", target: "Contract", joinColumn: { name: "contract_id" } },
  },
});

export const DocumentSchema = schema({
  name: "Document",
  tableName: "documents",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    file_name: { type: "varchar", length: 255 },
    mime_type: { type: "varchar", length: 100, nullable: true },
    object_path: { type: "varchar", length: 500, nullable: true },
    public_url: { type: "varchar", length: 1000, nullable: true },
    size_bytes: { type: "bigint", nullable: true },
    bucket: { type: "varchar", length: 100, nullable: true },
    type: { type: "varchar", length: 50, nullable: true },
    category: { type: "varchar", length: 50, nullable: true },
    contract_id: { type: "uuid", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    contract: { type: "many-to-one", target: "Contract", joinColumn: { name: "contract_id" }, nullable: true },
  },
});

export const PropertyImageSchema = schema({
  name: "PropertyImage",
  tableName: "property_images",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    component_id: { type: "varchar", length: 100, nullable: true },
    image_type: { type: "varchar", length: 50, default: "gallery" }, // cover | gallery | component
    file_name: { type: "varchar", length: 255 },
    public_url: { type: "varchar", length: 1000 },
    object_path: { type: "varchar", length: 500 },
    size_bytes: { type: "bigint", nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
  },
});

export const MaintenancePredictionSchema = schema({
  name: "MaintenancePrediction",
  tableName: "maintenance_predictions",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    unit_id: { type: "uuid" },
    prediction_date: { type: "date" },
    risk_score: { type: "int" },
    risk_level: { type: "varchar", length: 50 }, // low|medium|high|critical
    predicted_failure_type: { type: "varchar", length: 50 }, // ac|plumbing|electrical|general
    predicted_failure_date: { type: "date", nullable: true },
    suggested_action: { type: "text" },
    estimated_cost_sar: { type: "numeric", precision: 14, scale: 2, nullable: true },
    is_resolved: { type: "boolean", default: false },
    resolved_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  indices: [
    { name: "idx_maintenance_predictions_unit_id", columns: ["unit_id"] as string[] },
  ],
  relations: {
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, onDelete: "CASCADE" },
  },
});
