"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Smartphone, Monitor, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/auth-fetch";

type LoginEvent = {
  id: string;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
};

const FAILURE_LABELS: Record<string, string> = {
  invalid_password: "كلمة مرور خاطئة",
  invalid_pin: "رمز دخول خاطئ",
  pin_not_set: "لم يتم تفعيل رمز الدخول",
  account_not_found: "حساب غير موجود",
  account_inactive: "حساب معطل",
  no_active_contract: "لا يوجد عقد ساري",
};

function parseDevice(ua: string | null): string {
  if (!ua) return "متصفح";
  if (/Mobile|Android|iPhone/i.test(ua)) return "جوال";
  if (/Windows/i.test(ua)) return "ويندوز";
  if (/Macintosh/i.test(ua)) return "ماك";
  if (/Linux/i.test(ua)) return "لينكس";
  return "متصفح";
}

function DeviceIcon({ device }: { device: string }) {
  if (device === "جوال") return <Smartphone className="h-4 w-4" />;
  if (device === "ماك" || device === "ويندوز" || device === "لينكس")
    return <Monitor className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
}

export function LoginHistory() {
  const { data, isLoading } = useQuery<{ events?: LoginEvent[] }>({
    queryKey: ["login-history"],
    queryFn: async () => {
      const res = await authFetch("/api/auth/login-history");
      if (!res.ok) return { events: [] };
      return res.json();
    },
  });

  const events = Array.isArray(data?.events) ? data!.events : [];

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          سجل تسجيل الدخول
        </h2>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            لا توجد سجلات تسجيل دخول
          </p>
        )}

        {!isLoading && events.length > 0 && (
          <div className="space-y-2">
            {events.map((e) => {
              const device = parseDevice(e.user_agent);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                >
                  <div className="flex items-center gap-2">
                    {e.success ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    )}
                    <div className="space-y-0.5">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {e.created_at
                          ? new Date(e.created_at).toLocaleString("ar-SA", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <DeviceIcon device={device} />
                          {device}
                        </span>
                        {e.ip_address && <span dir="ltr">{e.ip_address}</span>}
                      </div>
                    </div>
                  </div>
                  {e.success ? (
                    <Badge variant="green">ناجح</Badge>
                  ) : (
                    <Badge variant="red">
                      فشل{e.failure_reason ? ` — ${FAILURE_LABELS[e.failure_reason] ?? e.failure_reason}` : ""}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}