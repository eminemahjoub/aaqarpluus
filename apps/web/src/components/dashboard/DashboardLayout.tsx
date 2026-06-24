"use client";

import * as React from "react";
import { LogOut, Menu, MessageSquare, Bell } from "lucide-react";
import { DashboardSidebar } from "./OwnerSidebar";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { authFetch } from "@/lib/auth-fetch";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OWNER_PROPERTIES_READ_ONLY_MESSAGE } from "@/lib/permissions";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: "owner" | "agency" | "personal";
}

export function DashboardLayout({ children, role = "personal" }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [resolvedRole, setResolvedRole] = React.useState<"owner" | "agency" | "personal">(role);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const showPropertiesReadOnlyBanner =
    resolvedRole === "owner" &&
    (pathname.startsWith("/dashboard/properties") || pathname.startsWith("/agency/properties"));

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/auth/me");
        if (!res.ok) return;
        const me = await res.json();
        const userType = String(me?.userType ?? "");
        const next: "owner" | "agency" | "personal" =
          userType === "agency" ? "agency" : userType === "personal" ? "personal" : "owner";
        if (!cancelled) setResolvedRole(next);
      } catch {
        // keep provided role
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 8000);
    try {
      await authFetch("/api/auth/logout", { method: "POST", signal: ac.signal });
    } catch {
      // ignore network errors; we'll still force a reload to guest mode
    } finally {
      window.clearTimeout(t);
      setLoggingOut(false);
      setSidebarOpen(false);
      window.location.assign("/");
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#0a1f16]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Fixed on mobile, static on desktop */}
      <aside
        className={[
          "fixed inset-y-0 right-0 z-50 transform shadow-2xl transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
          sidebarCollapsed ? "w-20" : "w-72",
        ].join(" ")}
      >
        <DashboardSidebar 
          onClose={() => setSidebarOpen(false)} 
          role={resolvedRole} 
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:mr-0">
        {/* Sticky Header - Always visible */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur-sm dark:border-emerald-800/30 dark:bg-[#132a1f]/95">
          {/* Right side - Logo (visible on desktop, always visible) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Logo - Always visible in header */}
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="عقار بلس" 
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="text-lg font-bold text-[#1B5E3C] dark:text-white">عقار بلس</span>
            </div>
          </div>

          {/* Left side */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200 lg:hidden">
              لوحة التحكم
            </h1>

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#102318] dark:text-gray-200 dark:hover:bg-white/5"
                aria-label="الإشعارات"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -left-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {notifOpen && (
                <div className="absolute left-0 top-12 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-emerald-800/50 dark:bg-[#132a1f]">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-emerald-800/30">
                    <span className="font-semibold text-gray-900 dark:text-white">الإشعارات</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAsRead()}
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        تحديد الكل مقروء
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">لا توجد إشعارات</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.is_read) markAsRead(n.id);
                            if (n.reference_type === "task" && n.reference_id) {
                              window.location.href = "/dashboard/maintenance";
                            } else if (n.reference_type === "conversation" && n.reference_id) {
                              window.location.href =
                                resolvedRole === "agency" ? "/agency/messages" : "/dashboard/messages";
                            }
                          }}
                          className={`w-full border-b border-gray-100 px-4 py-3 text-right transition hover:bg-gray-50 dark:border-emerald-800/30 dark:hover:bg-[#1a3528] ${
                            n.is_read ? "opacity-70" : "bg-indigo-50/30 dark:bg-indigo-900/10"
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{n.body}</p>
                          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                            {n.created_at ? String(n.created_at).split("T")[0] : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              href={resolvedRole === "agency" ? "/agency/messages" : "/dashboard/messages"}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#102318] dark:text-gray-200 dark:hover:bg-white/5"
              aria-label="الرسائل"
            >
              <MessageSquare className="h-5 w-5" />
            </Link>

            <ThemeToggle />

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-emerald-800/50 dark:bg-[#102318] dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{loggingOut ? "جاري الخروج…" : "تسجيل الخروج"}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {showPropertiesReadOnlyBanner ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100">
              {OWNER_PROPERTIES_READ_ONLY_MESSAGE}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
