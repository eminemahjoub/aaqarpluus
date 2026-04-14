"use client";

export type UploadProgress = { loaded: number; total: number; percent: number };

export function validateUploadFile(file: File, opts: { maxBytes: number; allowedMime: string[] }) {
  if (!file) return "الملف غير موجود";
  if (file.size > opts.maxBytes) return `حجم الملف كبير (الحد ${(opts.maxBytes / 1024 / 1024).toFixed(0)}MB)`;
  if (opts.allowedMime.length && !opts.allowedMime.includes(file.type)) return "نوع الملف غير مدعوم";
  return null;
}

export function uploadWithProgress(args: {
  url: string;
  formData: FormData;
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<Response> {
  const { url, formData, onProgress, signal } = args;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = evt.total > 0 ? Math.round((evt.loaded / evt.total) * 100) : 0;
      onProgress?.({ loaded: evt.loaded, total: evt.total, percent });
    };

    xhr.onerror = () => reject(new Error("network_error"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.onload = () => {
      const headers = new Headers();
      xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)
        .filter(Boolean)
        .forEach((line) => {
          const parts = line.split(": ");
          const header = parts.shift();
          if (!header) return;
          const value = parts.join(": ");
          headers.append(header, value);
        });
      resolve(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers }));
    };

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

