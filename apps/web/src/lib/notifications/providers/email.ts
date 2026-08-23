import { getDataSource } from "@/lib/db/data-source";
import type { ChannelProvider, NotificationEventType, NotificationPayload } from "../types";

export function isWithinQuietHours(quietHours: { start: string; end: string }, now: Date): boolean {
  const [sh, sm] = quietHours.start.split(":").map(Number);
  const [eh, em] = quietHours.end.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // overnight range (e.g. 22:00 → 08:00)
  return cur >= start || cur < end;
}

function nextMorning9AM(now: Date): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

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

function renderHtml(payload: NotificationPayload): { subject: string; html: string } {
  const m = payload.metadata;
  return {
    subject: SUBJECTS[payload.type] ?? "إشعار — عقار بلس",
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#222">
        <h2 style="color:#0b3d2e">${SUBJECTS[payload.type] ?? "إشعار"}</h2>
        <p>${String(m.preview ?? JSON.stringify(m))}</p>
        <p style="color:#666;font-size:12px">أرسلت عبر منصة عقار بلس</p>
      </div>`,
  };
}

/**
 * Email provider — queues rows into notification_queue (channel='email').
 * Delivery happens in the queue processor (lib/notifications/processor.ts)
 * via nodemailer. Quiet hours defer non-urgent mail to the next 9 AM.
 */
export class EmailProvider implements ChannelProvider {
  readonly channel = "email" as const;
  readonly name = "email";

  async send(payload: NotificationPayload): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    try {
      const ds = await getDataSource();
      const users = await ds.query(`SELECT email, phone FROM users WHERE id = $1 LIMIT 1`, [
        payload.recipientId,
      ]);
      const email = users?.[0]?.email;
      if (!email) return { success: false, error: "recipient has no email" };

      const queueId = crypto.randomUUID();
      const { subject, html } = renderHtml(payload);

      let scheduledFor: Date | null = null;
      const urgent = payload.priority === "urgent";
      if (!urgent) {
        const prefs = await this.getPreferences(payload.recipientId);
        const quiet = prefs.quietHours;
        if (quiet && isWithinQuietHours(quiet, new Date())) {
          scheduledFor = nextMorning9AM(new Date());
        }
      }

      await ds.query(
        `INSERT INTO notification_queue (id, notification_id, channel, payload, scheduled_for, status, created_at)
         VALUES ($1, $2, 'email', $3, $4, 'pending', NOW())`,
        [queueId, payload.id, JSON.stringify({ to: email, subject, html }), scheduledFor]
      );
      return { success: true, providerMessageId: queueId };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async isAvailable(payload: NotificationPayload): Promise<boolean> {
    const ds = await getDataSource();
    const users = await ds.query(`SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [
      payload.recipientId,
    ]);
    if (!users?.[0]?.email) return false;
    const prefs = await this.getPreferences(payload.recipientId);
    return prefs.enabled;
  }

  async getPreferences(userId: string): Promise<{ enabled: boolean; quietHours?: { start: string; end: string } }> {
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT email_enabled, quiet_hours FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const row = rows?.[0];
    const qh = row?.quiet_hours && typeof row.quiet_hours === "object" ? (row.quiet_hours as { start?: string; end?: string }) : null;
    return {
      enabled: row ? Boolean(row.email_enabled) : true,
      ...(qh?.start ? { quietHours: { start: qh.start, end: qh.end ?? "08:00" } } : {}),
    };
  }
}