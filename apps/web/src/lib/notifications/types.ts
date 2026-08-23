export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp" | "tenant";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationEventType =
  | "payment.received"
  | "payment.overdue"
  | "payment.partial"
  | "contract.signed"
  | "contract.renewal_due"
  | "contract.terminated"
  | "maintenance.requested"
  | "maintenance.assigned"
  | "maintenance.completed"
  | "maintenance.cancelled"
  | "message.received"
  | "announcement.published"
  | "receipt.generated";

export interface NotificationPayload {
  id: string;
  type: NotificationEventType;
  priority: NotificationPriority;
  actorId: string;
  recipientId: string;
  officeId: string;
  metadata: Record<string, unknown>;
  channels: NotificationChannel[];
  createdAt: Date;
}

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  send(payload: NotificationPayload): Promise<{
    success: boolean;
    providerMessageId?: string;
    error?: string;
    sentAt?: Date;
  }>;
  isAvailable(payload: NotificationPayload): Promise<boolean>;
  getPreferences(userId: string): Promise<{
    enabled: boolean;
    quietHours?: { start: string; end: string };
  }>;
}