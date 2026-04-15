"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { authFetch } from "@/lib/auth-fetch";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = React.useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      await authFetch("/api/auth/logout", { method: "POST", signal: ac.signal as any });
    } catch {
      // ignore
    } finally {
      clearTimeout(t);
      window.location.assign("/");
    }
  }, [loggingOut]);

  return (
    <div className="min-h-screen bg-[#fbfdfb] text-gray-900 dark:bg-[#070b08] dark:text-white">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(197,160,33,0.14),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px] dark:opacity-[0.08]" />
      </div>

      <div className="mx-auto flex w-full max-w-[1500px] gap-4 p-4 md:p-6">
        <AdminSidebar />

        <div className="min-w-0 flex-1">
          <header className="sticky top-3 z-20 mb-4">
            <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#C5A021] shadow-sm" />
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gradient-to-r from-emerald-600 to-[#C5A021] px-3 py-1 text-[11px] font-extrabold text-white">
                        SUPER ADMIN
                      </span>
                      <span className="text-sm font-extrabold text-gray-900 dark:text-white">لوحة إدارة المنصة</span>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                      إدارة المستخدمين • الاشتراكات • السجل • الإعدادات
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="rounded-2xl bg-gradient-to-r from-emerald-600 to-[#C5A021] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  >
                    {loggingOut ? "..." : "تسجيل الخروج"}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/70 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

