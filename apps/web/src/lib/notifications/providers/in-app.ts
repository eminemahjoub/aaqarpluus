import { getDataSource } from "@/lib/db/data-source";
import type { ChannelProvider, NotificationEventType, NotificationPayload } from "../types";

function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ar-SA") : String(v ?? "—");
}

const TEMPLATES: Record<
  NotificationEventType,
  { title: string; body: (m: Record<string, unknown>) => string }
> = {
  "payment.received": {
    title: "تم استلام دفعة",
    body: (m) => `تم استلام دفعة بمبلغ ${num(m.amount)} ر.س للوحدة ${String(m.unitNumber ?? "—")}`,
  },
  "payment.overdue": {
    title: "دفعة متأخرة",
    body: (m) => `لديك دفعة متأخرة بمبلغ ${num(m.amount)} ر.س للوحدة ${String(m.unitNumber ?? "—")}`,
  },
  "payment.partial": {
    title: "دفعة جزئية",
    body: (m) => `تم تسجيل دفعة جزئية بمبلغ ${num(m.amount)} ر.س للوحدة ${String(m.unitNumber ?? "—")}`,
  },
  "contract.signed": {
    title: "تم توقيع عقد جديد",
    body: (m) => `تم توقيع عقد ${String(m.unitNumber ?? "—")} بتاريخ ${String(m.signedAt ?? "—")}`,
  },
  "contract.renewal_due": {
    title: "اقترب موعد تجديد العقد",
    body: (m) => `العقد ينتهي بتاريخ ${String(m.expiryDate ?? "—")}. يرجى التواصل مع المستأجر للتجديد`,
  },
  "contract.terminated": {
    title: "تم إنهاء العقد",
    body: (m) => `تم إنهاء عقد الوحدة ${String(m.unitNumber ?? "—")}`,
  },
  "maintenance.requested": {
    title: "طلب صيانة جديد",
    body: (m) => `طلب صيانة جديد: ${String(m.issue ?? "—")} للوحدة ${String(m.unitNumber ?? "—")}`,
  },
  "maintenance.assigned": {
    title: "مهمة صيانة معينة لك",
    body: (m) => `${String(m.priority ?? "متوسطة")} الأولوية: ${String(m.issue ?? "—")}`,
  },
  "maintenance.completed": {
    title: "اكتملت مهمة الصيانة",
    body: (m) => `اكتملت مهمة الصيانة: ${String(m.issue ?? "—")}`,
  },
  "maintenance.cancelled": {
    title: "ألغيت مهمة الصيانة",
    body: (m) => `ألغيت مهمة الصيانة: ${String(m.issue ?? "—")}`,
  },
  "message.received": {
    title: "رسالة جديدة",
    body: (m) => `رسالة جديدة من ${String(m.senderName ?? "—")}: ${String(m.preview ?? "")}`,
  },
  "announcement.published": {
    title: "إعلان جديد",
    body: (m) => String(m.title ?? "إعلان جديد من المكتب"),
  },
  "receipt.generated": {
    title: "تم إنشاء وصل سداد",
    body: (m) => `وصل سداد بمبلغ ${num(m.amount)} ر.س للوحدة ${String(m.unitNumber ?? "—")}`,
  },
};

/** In-app provider — writes to the existing `notifications` table. */
export class InAppProvider implements ChannelProvider {
  readonly channel = "in_app" as const;
  readonly name = "in-app";

  async send(payload: NotificationPayload): Promise<{ success: boolean; sentAt?: Date; error?: string }> {
    try {
      const template = TEMPLATES[payload.type];
      const title = template?.title ?? "إشعار جديد";
      const body = template ? template.body(payload.metadata) : JSON.stringify(payload.metadata);
      const ds = await getDataSource();
      await ds.query(
        `INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [
          payload.recipientId,
          String(payload.type).slice(0, 50),
          title,
          body,
          payload.metadata.referenceId ? String(payload.metadata.referenceId) : null,
          payload.type,
        ]
      );
      return { success: true, sentAt: new Date() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async isAvailable(payload: NotificationPayload): Promise<boolean> {
    const ds = await getDataSource();
    try {
      const rows = await ds.query(`SELECT 1 AS ok FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [
        payload.recipientId,
      ]);
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  async getPreferences(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }
}