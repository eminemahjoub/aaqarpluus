export type {
  NotificationChannel,
  NotificationPriority,
  NotificationEventType,
  NotificationPayload,
  ChannelProvider,
} from "./types";

export { ProviderRegistry, registry } from "./registry";
export { NotificationDispatcher, notifications } from "./dispatcher";
export { InAppProvider } from "./providers/in-app";
export { EmailProvider, isWithinQuietHours } from "./providers/email";
export { SmsProvider } from "./providers/sms";
export { TenantProvider } from "./providers/tenant";
export { processPendingNotifications, startProcessingInterval } from "./processor";

import { InAppProvider } from "./providers/in-app";
import { EmailProvider } from "./providers/email";
import { SmsProvider } from "./providers/sms";
import { TenantProvider } from "./providers/tenant";
import { registry } from "./registry";

let initialized = false;

/**
 * Registers all providers on first call. Idempotent — safe to call from
 * app/layout.tsx or middleware on every boot.
 */
export function initializeNotifications(): void {
  if (initialized) return;
  initialized = true;
  registry.register(new InAppProvider());
  registry.register(new EmailProvider());
  registry.register(new SmsProvider());
  registry.register(new TenantProvider());
}

initializeNotifications();