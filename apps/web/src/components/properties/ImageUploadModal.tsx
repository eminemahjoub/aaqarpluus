"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth-fetch";

export function ImageUploadModal({
  open,
  onClose,
  propertyId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("اختر صورة");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("property_id", propertyId);
      fd.append("image_type", "gallery");
      const res = await authFetch("/api/property-images", { method: "POST", body: fd });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(String(errBody?.error ?? "تعذر رفع الصورة"));
        return;
      }
      onSaved();
      onClose();
      setFile(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>رفع صور</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>الصورة</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? "جاري الرفع..." : "رفع"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}