"use client";

import * as React from "react";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { MessageInput } from "@/components/messages/MessageInput";
import { useMessagePolling } from "@/hooks/useMessagePolling";
import { authFetch } from "@/lib/auth-fetch";

export function ChatArea({ conversationId }: { conversationId: string | null }) {
  const { messages, isLoading, error, sendMessage } = useMessagePolling(conversationId);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const [meId, setMeId] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/auth/me");
        if (!res.ok) return;
        const j = await res.json().catch(() => ({}));
        const id = String(j?.id ?? "");
        if (!cancelled) setMeId(id);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  if (!conversationId) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">اختر محادثة</div>;
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-[#0a1f16]">
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? <div className="text-sm text-gray-500">جاري التحميل…</div> : null}
        {error ? <div className="text-sm text-red-600 dark:text-red-300">تعذر تحميل الرسائل</div> : null}
        <div className="space-y-2">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} isMine={Boolean(meId) ? String(m.sender?.id) === meId : m.sender?.id === "me"} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <MessageInput onSend={sendMessage} disabled={false} />
    </div>
  );
}

