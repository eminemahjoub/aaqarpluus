import * as React from "react";
import { authFetch } from "@/lib/auth-fetch";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  type: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/notifications", { method: "GET" });
      if (!res.ok) throw new Error("فشل تحميل الإشعارات");
      const json = await res.json();
      setNotifications((json?.notifications ?? []) as NotificationItem[]);
      setUnreadCount(Number(json?.unreadCount ?? 0));
    } catch {
      setError("فشل تحميل الإشعارات");
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = React.useCallback(
    async (id?: string) => {
      try {
        const res = await authFetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id ? { id } : { all: true }),
        });
        if (!res.ok) throw new Error("فشل تحديث الإشعارات");
        await refresh();
      } catch {
        setError("فشل تحديث الإشعارات");
      }
    },
    [refresh]
  );

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!mounted) return;
      await refresh();
    })();
    const t = window.setInterval(() => void refresh(), 30_000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, [refresh]);

  return { notifications, unreadCount, loading, error, refresh, markAsRead };
}
