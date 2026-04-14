"use client";

import * as React from "react";
import { LogOut, Menu } from "lucide-react";
import { DashboardSidebar } from "./OwnerSidebar";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { authFetch } from "@/lib/auth-fetch";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: "owner" | "agency" | "personal";
}

export function DashboardLayout({ children, role = "personal" }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [resolvedRole, setResolvedRole] = React.useState<"owner" | "agency" | "personal">(role);
  const [loggingOut, setLoggingOut] = React.useState(false);

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
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
