"use client";

import * as React from "react";
import { Menu, ChevronRight, ChevronLeft } from "lucide-react";
import { DashboardSidebar } from "./OwnerSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: "owner" | "agency" | "personal";
}

export function DashboardLayout({ children, role = "personal" }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

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
          role={role} 
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
            
            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center gap-2 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              title={sidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
            >
              {sidebarCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
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

          {/* Left side - Page title on mobile */}
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200 lg:hidden">
            لوحة التحكم
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
