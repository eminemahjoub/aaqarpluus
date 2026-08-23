"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_MB = 10;

/**
 * Property-scoped document uploader for the drawer.
 * Client-side validation mirrors the requested policy (PDF/DOC/DOCX ≤ 10MB);
 * the API itself deliberately stays permissive (legacy documents page
 * uploads Excel/images too — tightening server-side would break it).
 */
export function DocumentUploader({
  propertyId,
  onUpload,
}: {
  propertyId: string;
  onUpload: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_MIME.includes(file.type)) {
      setError("صيغة غير مدعومة. المسموح: PDF, DOC, DOCX");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`الملف كبير جداً. الحد الأقصى ${MAX_MB} ميجابايت`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("property_id", propertyId);
      const res = await authFetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(String(errBody?.error ?? "تعذر رفع المستند"));
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      onUpload();
    } catch {
      setError("تعذر رفع المستند");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {uploading ? "جاري الرفع..." : "رفع مستند"}
      </Button>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        PDF, DOC, DOCX — بحد أقصى {MAX_MB} ميجابايت
      </span>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}