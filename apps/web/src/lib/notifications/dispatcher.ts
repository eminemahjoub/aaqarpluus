import { randomUUID } from "crypto";
import { getDataSource } from "@/lib/db/data-source";
import { registry } from "./registry";
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationPayload,
} from "./types";

const DEFAULT_CHANNELS: Record<NotificationEventType, NotificationChannel[]> = {
  "payment.received": ["in_app", "email", "tenant"],
  "payment.overdue": ["in_app", "email", "sms", "tenant"],
  "payment.partial": ["in_app", "email", "tenant"],
  "contract.signed": ["in_app", "email"],
  "contract.renewal_due": ["in_app", "email"],
  "contract.terminated": ["in_app", "email"],
  "maintenance.requested": ["in_app", "email"],
  "maintenance.assigned": ["in_app", "sms", "tenant"],
  "maintenance.completed": ["in_app"],
  "maintenance.cancelled": ["in_app"],
  "message.received": ["in_app"],
  "announcement.published": ["in_app", "email"],
  "receipt.generated": ["in_app", "email"],
};

/**
 * Notification dispatcher — business logic emits events, this decides
 * channels, persists the audit log and hands delivery to providers.
 *
 * Status note: notification_log.status CHECK allows only
 * pending | sent | failed (migration 006) — the initial row is 'pending'
 * and the final state is 'sent'/'failed' (no 'processing'/'completed').
 */
export class NotificationDispatcher {
  getDefaultChannels(type: NotificationEventType): NotificationChannel[] {
    return DEFAULT_CHANNELS[type] ?? ["in_app"];
  }

  async dispatch(
    input: Omit<NotificationPayload, "id" | "createdAt">
  ): Promise<NotificationPayload> {
    const ds = await getDataSource();
    const payload: NotificationPayload = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
      channels: Array.from(
        new Set(input.channels.length > 0 ? input.channels : this.getDefaultChannels(input.type))
      ),
    };
    const logChannels = Array.from(new Set<NotificationChannel>(["in_app", ...payload.channels]));

    // Resolve a valid office_id (FK to offices): explicit → actor → recipient.
    let officeId = input.officeId || null;
    if (!officeId) {
      const officeRows = await ds.query(
        `SELECT COALESCE(o.office_id, (SELECT office_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1)) AS office_id
           FROM users o WHERE o.id = $1 AND deleted_at IS NULL LIMIT 1`,
        [input.actorId]
      ).catch(() => []);
      officeId = officeRows?.[0]?.office_id ?? null;
      if (!officeId) {
        const recRows = await ds.query(
          `SELECT office_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
          [input.recipientId]
        ).catch(() => []);
        officeId = recRows?.[0]?.office_id ?? null;
      }
    }
    payload.officeId = officeId ?? "";

    // Audit row (skipped when no office can be resolved — FK would fail).
    const canLog = Boolean(payload.officeId);
    if (canLog) {
      await ds.query(
        `INSERT INTO notification_log
           (id, type, actor_id, recipient_id, office_id, metadata, channels, results, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, 'pending', NOW())`,
        [
          payload.id,
          payload.type,
          payload.actorId,
          payload.recipientId,
          payload.officeId,
          JSON.stringify(payload.metadata),
          logChannels,
        ]
      );
    }

    const results: { channel: NotificationChannel; success: boolean; error?: string; providerMessageId?: string }[] = [];

    // 1) In-app is always attempted.
    const inApp = registry.get("in_app");
    if (inApp) {
      try {
        results.push({ channel: "in_app", ...(await inApp.send(payload)) });
      } catch (err) {
        results.push({ channel: "in_app", success: false, error: String(err) });
      }
    }

    // 2) Requested channels — availability + preferences gate delivery.
    for (const channel of payload.channels) {
      if (channel === "in_app") continue;
      const provider = registry.get(channel);
      if (!provider) continue;
      try {
        const available = await provider.isAvailable(payload);
        if (!available) continue;
        const prefs = await provider.getPreferences(payload.recipientId);
        if (!prefs.enabled) continue;
        results.push({ channel, ...(await provider.send(payload)) });
      } catch (err) {
        results.push({ channel, success: false, error: String(err) });
      }
    }

    // 3) Close the audit row.
    if (canLog) {
      const inAppOk = results.find((r) => r.channel === "in_app")?.success !== false;
      await ds.query(
        `UPDATE notification_log
            SET results = $2::jsonb, status = $3, sent_at = $4
          WHERE id = $1`,
        [
          payload.id,
          JSON.stringify(results),
          inAppOk ? "sent" : "failed",
          inAppOk ? new Date().toISOString() : null,
        ]
      );
    }

    return payload;
  }
}

export const notifications = new NotificationDispatcher();