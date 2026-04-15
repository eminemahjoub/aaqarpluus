"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { UnreadBadge } from "@/components/messages/UnreadBadge";

export type ConversationItem = {
  id: string;
  type: string;
  subject: string | null;
  participants: Array<{ id: string; name: string; role: string; is_active?: boolean }>;
  lastMessage?: { content: string | null; sender_name: string | null; created_at: string | null; type: string } | null;
  unreadCount: number;
  is_archived: boolean;
  created_at: string | null;
  property?: { id: string; name: string } | null;
  unit?: { id: string; label?: string } | null;
};

export function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ConversationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
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

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: "1", limit: "30" });
      if (q.trim()) qs.set("search", q.trim());
      const res = await authFetch(`/api/messages/conversations?${qs.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      setItems((json?.items ?? []) as ConversationItem[]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const t = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white dark:border-emerald-800/30 dark:bg-[#102318]">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pr-9 pl-3 text-sm outline-none focus:border-emerald-400 dark:border-emerald-800/50 dark:bg-[#0f2419] dark:text-white"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && items.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">جاري التحميل…</div>
        ) : null}
        {items.length === 0 && !loading ? (
          <div className="p-3 text-sm text-gray-500">لا توجد محادثات بعد — ابدأ محادثة جديدة</div>
        ) : null}
        <div className="space-y-2">
          {items.map((c) => {
            const isActive = c.id === activeId;
            const otherParticipantName =
              c.type === "direct" && meId
                ? (c.participants ?? []).find((p) => String(p.id) !== meId)?.name
                : null;
            const otherParticipantActive =
              c.type === "direct" && meId
                ? (c.participants ?? []).find((p) => String(p.id) !== meId)?.is_active
                : undefined;
            const title = otherParticipantName || c.subject || c.property?.name || "محادثة";
            const previewText =
              c.lastMessage?.content ??
              (c.lastMessage?.type === "file" ? "ملف" : c.lastMessage?.type === "image" ? "صورة" : "");
            const sender = c.lastMessage?.sender_name ? String(c.lastMessage.sender_name) : "";
            const preview = sender ? `${sender}: ${previewText || "—"}` : previewText || "—";
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={[
                  "w-full rounded-2xl border px-3 py-3 text-right transition",
                  isActive
                    ? "border-emerald-400/50 bg-emerald-50 dark:border-emerald-500/30 dark:bg-white/5"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#0f2419] dark:hover:bg-white/5",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {typeof otherParticipantActive === "boolean" ? (
                      <span
                        className={[
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          otherParticipantActive ? "bg-emerald-500" : "bg-red-500",
                        ].join(" ")}
                        title={otherParticipantActive ? "متصل" : "غير متصل"}
                        aria-label={otherParticipantActive ? "متصل" : "غير متصل"}
                      />
                    ) : null}
                    <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</div>
                  </div>
                  <UnreadBadge count={Number(c.unreadCount ?? 0)} />
                </div>
                <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{preview}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

