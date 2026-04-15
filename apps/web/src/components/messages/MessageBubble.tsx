"use client";

import type { ChatMessage } from "@/hooks/useMessagePolling";
import { cn } from "@/lib/utils";

function formatMsgTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function MessageBubble({
  msg,
  isMine,
}: {
  msg: ChatMessage;
  isMine: boolean;
}) {
  const bubble = isMine
    ? "bg-blue-500 text-white dark:bg-blue-600"
    : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white";

  if (msg.type === "system") {
    return <div className="py-2 text-center text-sm text-gray-500">{msg.content ?? ""}</div>;
  }

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm", bubble)}>
        <div className={cn("mb-1 flex items-center justify-between gap-3 text-[11px] opacity-90", isMine ? "text-white/90" : "text-gray-600 dark:text-gray-200")}>
          <span className="truncate font-semibold">{isMine ? "أنت" : msg.sender?.name ?? "—"}</span>
          <span className="shrink-0">{formatMsgTime(msg.created_at)}</span>
        </div>
        {msg.is_deleted ? (
          <div className="italic opacity-80">تم حذف هذه الرسالة</div>
        ) : (
          <>
            {msg.type === "text" ? <div className="whitespace-pre-wrap">{msg.content}</div> : null}
            {msg.type === "image" && msg.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.file_url} alt={msg.file_name ?? "image"} className="mt-1 max-h-64 rounded-lg object-contain" />
            ) : null}
            {msg.type === "file" && msg.file_url ? (
              <a
                className="mt-1 block rounded-lg bg-black/10 px-3 py-2 text-sm underline-offset-2 hover:underline dark:bg-white/10"
                href={msg.file_url}
                target="_blank"
                rel="noreferrer"
              >
                {msg.file_name ?? "ملف"} {msg.file_size ? `(${Math.round((msg.file_size / 1024) * 10) / 10}KB)` : ""}
              </a>
            ) : null}
            {msg.is_edited ? <div className="mt-1 text-[11px] opacity-75">تم التعديل</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

