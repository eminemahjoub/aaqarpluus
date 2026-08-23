import { getDataSource } from "@/lib/db/data-source";
import type { ChannelProvider, NotificationPayload } from "../types";
import { isWithinQuietHours } from "./email";

/**
 * SMS provider — currently a queueing stub.
 * TODO: integrate Twilio / UNIFONIC / SMSA when ready.
 */
export class SmsProvider implements ChannelProvider {
  readonly channel = "sms" as const;
  readonly name = "sms";

  async send(payload: NotificationPayload): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    try {
      const ds = await getDataSource();
      const users = await ds.query(`SELECT phone FROM users WHERE id = $1 LIMIT 1`, [payload.recipientId]);
      const phone = users?.[0]?.phone;
      if (!phone) return { success: false, error: "recipient has no phone" };

      const queueId = crypto.randomUUID();
      const urgent = payload.priority === "urgent";
      let scheduledFor: Date | null = null;
      if (!urgent) {
        const prefs = await this.getPreferences(payload.recipientId);
        const quiet = prefs.quietHours;
        if (quiet && isWithinQuietHours(quiet, new Date())) {
          const next9 = new Date();
          next9.setDate(next9.getDate() + 1);
          next9.setHours(9, 0, 0, 0);
          scheduledFor = next9;
        }
      }

      await ds.query(
        `INSERT INTO notification_queue (id, notification_id, channel, payload, scheduled_for, status, created_at)
         VALUES ($1, $2, 'sms', $3, $4, 'pending', NOW())`,
        [queueId, payload.id, JSON.stringify({ to: phone, text: String(payload.metadata.preview ?? "") }), scheduledFor]
      );
      return { success: true, providerMessageId: queueId };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async isAvailable(payload: NotificationPayload): Promise<boolean> {
    const prefs = await this.getPreferences(payload.recipientId);
    if (!prefs.enabled) return false;
    const ds = await getDataSource();
    const users = await ds.query(`SELECT phone FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [
      payload.recipientId,
    ]);
    return Boolean(users?.[0]?.phone);
  }

  async getPreferences(userId: string): Promise<{ enabled: boolean; quietHours?: { start: string; end: string } }> {
    const ds = await getDataSource();
    const rows = await ds.query(
      `SELECT sms_enabled, quiet_hours FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const row = rows?.[0];
    const qh = row?.quiet_hours && typeof row.quiet_hours === "object" ? (row.quiet_hours as { start?: string; end?: string }) : null;
    return {
      enabled: row ? Boolean(row.sms_enabled) : false,
      ...(qh?.start ? { quietHours: { start: qh.start, end: qh.end ?? "08:00" } } : {}),
    };
  }
}