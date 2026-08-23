"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TenantPII {
  id?: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
}

/**
 * Owner-only unmask card. Security rule: the owner gate lives in the API
 * (`/api/properties/:id/tenant-pii`, 403 for non-owners). This component
 * never decides authorization — it only renders what the API returns.
 */
export default function MaskedTenantCard({
  propertyId,
  maskedTenant,
}: {
  propertyId: string;
  maskedTenant: TenantPII;
}) {
  const [unmasked, setUnmasked] = useState(false);
  const [fullData, setFullData] = useState<TenantPII | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (unmasked) {
      setUnmasked(false);
      return;
    }
    if (fullData) {
      setUnmasked(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/tenant-pii`,
        { credentials: "include" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 403) setError("غير مصرح لك بعرض بيانات المستأجر");
        else setError(String(body?.error ?? "تعذر تحميل البيانات"));
        return;
      }
      setFullData(body);
      setUnmasked(true);
    } catch {
      setError("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const mask = (val: string | null | undefined) => {
    if (!val || val.length < 4) return "••••••";
    return val.slice(0, 2) + "••••••" + val.slice(-2);
  };

  const display = unmasked && fullData ? fullData : maskedTenant;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {maskedTenant.name || "المستأجر"}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggle}
            disabled={loading}
            aria-label={unmasked ? "إخفاء البيانات" : "عرض البيانات"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : unmasked ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {unmasked ? "إخفاء" : "إظهار"}
          </Button>
        </div>

        {error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-2 text-sm">
          <Row label="رقم الجوال" value={unmasked ? display.phone : mask(display.phone)} ltr />
          <Row label="البريد الإلكتروني" value={unmasked ? display.email : mask(display.email)} />
          <Row label="رقم الهوية" value={unmasked ? display.id_number : mask(display.id_number)} ltr />
        </div>

        {unmasked && (
          <p className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Lock className="h-3 w-3" />
            مرئي لأنك مالك هذا العقار
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, ltr }: { label: string; value: string | null | undefined; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="font-medium text-gray-900 dark:text-white"
      >
        {value || "—"}
      </span>
    </div>
  );
}