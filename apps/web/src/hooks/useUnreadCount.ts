import * as React from "react";
import { authFetch } from "@/lib/auth-fetch";

export function useUnreadCount() {
  const [totalUnread, setTotalUnread] = React.useState(0);
  const [conversationCounts, setConversationCounts] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setError(null);
      const res = await authFetch("/api/messages/notifications", { method: "GET" });
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setTotalUnread(Number(json?.totalUnread ?? 0));
      setConversationCounts((json?.conversations ?? {}) as Record<string, number>);
    } catch {
      setError("failed");
    }
  }, []);

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

  return { totalUnread, conversationCounts, refresh, error };
}

