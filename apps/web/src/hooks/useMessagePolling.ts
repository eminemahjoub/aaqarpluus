import * as React from "react";
import { authFetch } from "@/lib/auth-fetch";

export type ChatMessage = {
  id: string;
  sender: { id: string; name: string; role: string };
  content: string | null;
  type: "text" | "image" | "file" | "system";
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  read_by: Array<{ user_id: string; read_at: string }>;
  created_at: string;
};

export function useMessagePolling(conversationId: string | null) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastIdRef = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/messages/conversations/${conversationId}/messages?limit=50&page=1`, { method: "GET" });
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      const items = (json?.items ?? []) as ChatMessage[];
      setMessages(items.reverse()); // UI: oldest -> newest
      lastIdRef.current = items?.[0]?.id ?? null;
    } catch {
      setError("failed");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const poll = React.useCallback(async () => {
    if (!conversationId) return;
    try {
      // simplest polling: refetch first page and merge (cheap for 50)
      const res = await authFetch(`/api/messages/conversations/${conversationId}/messages?limit=50&page=1`, { method: "GET" });
      if (!res.ok) return;
      const json = await res.json();
      const newestFirst = (json?.items ?? []) as ChatMessage[];
      const next = newestFirst.reverse();
      setMessages(next);
      lastIdRef.current = newestFirst?.[0]?.id ?? null;
    } catch {
      // ignore
    }
  }, [conversationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!conversationId) return;
    const t = window.setInterval(() => void poll(), 5000);
    return () => window.clearInterval(t);
  }, [conversationId, poll]);

  const sendMessage = React.useCallback(
    async (args: { content?: string; file?: File | null; type?: "text" | "image" | "file" }) => {
      if (!conversationId) return;
      const type = args.type ?? "text";
      const optimisticId = `tmp_${Date.now()}`;
      const now = new Date().toISOString();

      if (type === "text") {
        const content = (args.content ?? "").trim();
        if (!content) return;
        setMessages((prev) => [
          ...prev,
          {
            id: optimisticId,
            sender: { id: "me", name: "أنا", role: "me" },
            content,
            type: "text",
            is_edited: false,
            is_deleted: false,
            read_by: [],
            created_at: now,
          },
        ]);
        const res = await authFetch(`/api/messages/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "text", content }),
        });
        if (res.ok) void poll();
        return;
      }

      const file = args.file;
      if (!file) return;
      const fd = new FormData();
      fd.set("type", type);
      fd.set("file", file);
      if (args.content) fd.set("content", args.content);
      const res = await authFetch(`/api/messages/conversations/${conversationId}/messages`, { method: "POST", body: fd });
      if (res.ok) void poll();
    },
    [conversationId, poll]
  );

  return { messages, isLoading: loading, error, reload: load, sendMessage, lastIdRef };
}

