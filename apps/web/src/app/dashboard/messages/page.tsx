"use client";

import * as React from "react";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatArea } from "@/components/messages/ChatArea";

export default function OwnerMessagesPage() {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("c");
      if (c) setActiveId(String(c));
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="h-[calc(100vh-6.5rem)] rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-emerald-800/30 dark:bg-[#102318]">
      <div className="grid h-full grid-cols-1 md:grid-cols-[360px_1fr]">
        <ConversationList activeId={activeId} onSelect={setActiveId} />
        <ChatArea conversationId={activeId} />
      </div>
    </div>
  );
}

