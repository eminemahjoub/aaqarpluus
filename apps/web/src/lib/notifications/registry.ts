import type { ChannelProvider, NotificationChannel } from "./types";

/**
 * Provider registry. Providers register once at boot (initializeNotifications)
 * and are never mutated afterwards — callers only read.
 */
export class ProviderRegistry {
  private providers = new Map<NotificationChannel, ChannelProvider>();

  register(provider: ChannelProvider): void {
    if (this.providers.has(provider.channel)) {
      this.providers.set(provider.channel, provider);
      return;
    }
    this.providers.set(provider.channel, provider);
  }

  get(channel: NotificationChannel): ChannelProvider | undefined {
    return this.providers.get(channel);
  }

  getAll(): ChannelProvider[] {
    return Array.from(this.providers.values());
  }

  has(channel: NotificationChannel): boolean {
    return this.providers.has(channel);
  }
}

export const registry = new ProviderRegistry();