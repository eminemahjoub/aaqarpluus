"use client";

import * as React from "react";
import { Paperclip, Send } from "lucide-react";
import { validateUploadFile } from "@/lib/upload";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (args: { content?: string; file?: File | null; type?: "text" | "image" | "file" }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onPickFile(f: File | null) {
    setFileError(null);
    setFile(f);
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const err = validateUploadFile(f, {
      maxBytes: isImage ? 10 * 1024 * 1024 : 20 * 1024 * 1024,
      allowedMime: isImage ? ["image/png", "image/jpeg", "image/webp", "image/gif"] : [],
    });
    if (err) {
      setFile(null);
      setFileError(err);
    }
  }

  async function send() {
    if (disabled) return;
    if (file) {
      const isImage = file.type.startsWith("image/");
      await onSend({ file, type: isImage ? "image" : "file", content: text.trim() || undefined });
      setText("");
      setFile(null);
      return;
    }
    const content = text.trim();
    if (!content) return;
    await onSend({ content, type: "text" });
    setText("");
  }

  return (
    <div className="border-t border-gray-200 bg-white p-3 dark:border-emerald-800/30 dark:bg-[#102318]">
      {fileError ? <div className="mb-2 text-sm text-red-600 dark:text-red-300">{fileError}</div> : null}
      {file ? (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
          <div className="truncate">{file.name}</div>
          <button className="text-red-600 hover:underline dark:text-red-300" onClick={() => setFile(null)} type="button">
            إزالة
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={pick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#0f2419] dark:text-gray-200 dark:hover:bg-white/5"
          aria-label="إرفاق ملف"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="اكتب رسالة…"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-emerald-800/50 dark:bg-[#0f2419] dark:text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => void send()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1B5E3C] px-4 text-sm font-semibold text-white hover:bg-[#144d30] disabled:opacity-60"
          disabled={disabled}
        >
          <Send className="h-4 w-4" />
          إرسال
        </button>
      </div>
    </div>
  );
}

