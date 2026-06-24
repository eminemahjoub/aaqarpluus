import { EntitySchema, type EntitySchemaOptions } from "typeorm";

function schema(opts: EntitySchemaOptions<any>): EntitySchema {
  return new EntitySchema(opts);
}

export { UserSchema } from "./user";
export { PropertySchema } from "./property";
export { ContactSchema } from "./contact";
export { ContractSchema } from "./contract";

// Inline schemas below will be progressively extracted into per-entity files.

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
    { name: "idx_conv_participants_conv", columns: ["conversation_id"] as any },
    { name: "idx_conv_participants_user", columns: ["user_id"] as any },
    { name: "ux_conv_participants_conv_user", columns: ["conversation_id", "user_id"] as any, unique: true },
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
    { name: "idx_messages_conv_created", columns: ["conversation_id", "created_at"] as any },
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
    { name: "idx_msg_notif_user_read", columns: ["user_id", "is_read"] as any },
    { name: "idx_msg_notif_conv", columns: ["conversation_id"] as any },
  ],
  relations: {
    user: { type: "many-to-one", target: "User", joinColumn: { name: "user_id" } },
    conversation: { type: "many-to-one", target: "Conversation", joinColumn: { name: "conversation_id" }, onDelete: "CASCADE" },
    message: { type: "many-to-one", target: "Message", joinColumn: { name: "message_id" }, onDelete: "CASCADE" },
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
    notes: { type: "text", nullable: true },
    created_at: { type: "timestamp", createDate: true },
    updated_at: { type: "timestamp", updateDate: true },
  },
  relations: {
    contract: { type: "many-to-one", target: "Contract", joinColumn: { name: "contract_id" } },
  },
});

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

export const RevenueSchema = schema({
  name: "Revenue",
  tableName: "revenues",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    contract_id: { type: "uuid", nullable: true },
    contact_id: { type: "uuid", nullable: true },
    type: { type: "varchar", length: 100, nullable: true },
    amount_sar: { type: "numeric", precision: 14, scale: 2 },
    payment_method: { type: "varchar", length: 100, nullable: true },
    received_at: { type: "timestamp", nullable: true },
    description: { type: "text", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
    contact: { type: "many-to-one", target: "Contact", joinColumn: { name: "contact_id" }, nullable: true },
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

export const ExpenseSchema = schema({
  name: "Expense",
  tableName: "expenses",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    owner_id: { type: "uuid" },
    property_id: { type: "uuid", nullable: true },
    unit_id: { type: "uuid", nullable: true },
    related_revenue_id: { type: "uuid", nullable: true },
    contact_id: { type: "uuid", nullable: true },
    type: { type: "varchar", length: 100, nullable: true },
    amount_sar: { type: "numeric", precision: 14, scale: 2 },
    payment_method: { type: "varchar", length: 100, nullable: true },
    paid_at: { type: "timestamp", nullable: true },
    description: { type: "text", nullable: true },
    deleted_at: { type: "timestamp", nullable: true },
    created_at: { type: "timestamp", createDate: true },
  },
  relations: {
    owner: { type: "many-to-one", target: "User", joinColumn: { name: "owner_id" } },
    property: { type: "many-to-one", target: "Property", joinColumn: { name: "property_id" }, nullable: true },
    unit: { type: "many-to-one", target: "Unit", joinColumn: { name: "unit_id" }, nullable: true },
    contact: { type: "many-to-one", target: "Contact", joinColumn: { name: "contact_id" }, nullable: true },
  },
});
