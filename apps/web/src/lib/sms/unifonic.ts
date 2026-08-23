import { SMSProvider, type SendSMSParams, type SendSMSResult } from "./types";
import { normalizeSaudiNumber } from "./utils";

/**
 * UNIFONIC adapter — form-urlencoded API (the real endpoint accepts
 * application/x-www-form-urlencoded, not JSON). Arabic support via
 * Encoding=UTF8; recipient normalized to E.164 Saudi format.
 */
export class UnifonicProvider extends SMSProvider {
  async send({ to, body }: SendSMSParams): Promise<SendSMSResult> {
    const normalized = normalizeSaudiNumber(to);
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;
    const baseUrl = (process.env.SMS_BASE_URL || "https://api.unifonic.com").replace(/\/$/, "");
    if (!apiKey) throw new Error("SMS_API_KEY not configured");

    const params = new URLSearchParams();
    params.set("AppSid", apiKey);
    if (senderId) params.set("SenderID", senderId);
    params.set("Recipient", normalized);
    params.set("Body", body);
    params.set("Encoding", "UTF8");

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/rest/SMS/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new Error(`UNIFONIC network error: ${String(err)}`);
    }

    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(`UNIFONIC HTTP ${res.status}`);
    }
    if (
      data.success === false ||
      (data.errorCode !== undefined && data.errorCode !== null && data.errorCode !== 0)
    ) {
      throw new Error(
        `UNIFONIC error ${String(data.errorCode ?? "")}: ${String(data.message ?? data.description ?? "")}`
      );
    }

    return {
      messageId: String(data.MessageID ?? data.messageId ?? ""),
      status: data.messageStatus === "queued" ? "queued" : "sent",
    };
  }
}