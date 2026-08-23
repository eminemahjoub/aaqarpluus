import { getDataSource } from "@/lib/db/data-source";
import type { ChannelProvider, NotificationEventType, NotificationPayload } from "../types";

const SUBJECTS: Record<NotificationEventType, string> = {
  "payment.received": "تم استلام دفعة — عقار بلس",
  "payment.overdue": "تنبيه: دفعة متأخرة",
  "payment.partial": "تم تسجيل دفعة جزئية",
  "contract.signed": "تم توقيع عقد جديد",
  "contract.renewal_due": "اقترب موعد تجديد العقد",
  "contract.terminated": "تم إنهاء العقد",
  "maintenance.requested": "طلب صيانة جديد",
  "maintenance.assigned": "مهمة صيانة معينة لك",
  "maintenance.completed": "اكتملت مهمة الصيانة",
  "maintenance.cancelled": "ألغيت مهمة الصيانة",
  "message.received": "رسالة جديدة",
  "announcement.published": "إعلان جديد",
  "receipt.generated": "وصل سداد",
};

/**
 * Tenant channel — a virtual channel that resolves a tenant contact
 * (metadata.tenantId → contacts.id) and fans out to SMS/email queue rows.
 * Recipients are contacts (PIN auth), not users, so nothing touches the
 * notifications FK to users; the audit log keeps the owning user as
 * recipient_id (the dispatcher's recipientId).
 */
export class TenantProvider implements ChannelProvider {
  readonly channel = "tenant" as const;
  readonly name = "tenant";

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string; sentAt?: Date }> {
    try {
      const tenantId = payload.metadata.tenantId ? String(payload.metadata.tenantId) : null;
      if (!tenantId) return { success: false, error: "metadata.tenantId missing" };

      const ds = await getDataSource();
      const rows = await ds.query(
        `SELECT phone, email FROM contacts WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [tenantId]
      );
      const contact = rows?.[0];
      if (!contact) return { success: false, error: "tenant contact not found" };

      const subject = SUBJECTS[payload.type] ?? "إشعار — عقار بلس";
      const preview = String(payload.metadata.preview ?? "");

      let queued = 0;
      if (contact.phone) {
        await ds.query(
          `INSERT INTO notification_queue (id, notification_id, channel, payload, scheduled_for, status, created_at)
           VALUES ($1, $2, 'sms', $3, NULL, 'pending', NOW())`,
          [crypto.randomUUID(), payload.id, JSON.stringify({ to: String(contact.phone), text: preview })]
        );
        queued++;
      }
      if (contact.email) {
        await ds.query(
          `INSERT INTO notification_queue (id, notification_id, channel, payload, scheduled_for, status, created_at)
           VALUES ($1, $2, 'email', $3, NULL, 'pending', NOW())`,
          [
            crypto.randomUUID(),
            payload.id,
            JSON.stringify({
              to: String(contact.email),
              subject,
              html: `<div dir="rtl" style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#222"><h2 style="color:#0b3d2e">${subject}</h2><p>${preview}</p></div>`,
            }),
          ]
        );
        queued++;
      }

      if (queued === 0) return { success: false, error: "tenant has no phone or email" };
      return { success: true, sentAt: new Date() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async isAvailable(payload: NotificationPayload): Promise<boolean> {
    const tenantId = payload.metadata.tenantId ? String(payload.metadata.tenantId) : null;
    if (!tenantId) return false;
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT phone, email FROM contacts WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [tenantId]
    );
    const c = rows?.[0];
    return Boolean(c && (c.phone || c.email));
  }

  async getPreferences(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }
}