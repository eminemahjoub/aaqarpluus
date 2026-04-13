"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, X } from "lucide-react";
interface DashboardSidebarProps {
  onClose?: () => void;
}

export function DashboardSidebar({ onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 8000);
    try {
      await fetch("/api/auth/logout", { method: "POST", signal: ac.signal });
    } catch {
      // ignore network errors; we'll still force a reload to guest mode
    } finally {
      window.clearTimeout(t);
      setLoggingOut(false);
      onClose?.();
      window.location.assign("/");
    }
  }

  const menuItems = [
    {
      href: "/dashboard",
      label: "لوحة التحكم",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-primary transition hover:text-secondary"
        >
          <Image
            src="/logo.png"
            alt="عقار بلس"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-contain"
            priority
          />
          <span>عقار بلس</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                item.active
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          {loggingOut ? "جاري تسجيل الخروج…" : "تسجيل الخروج"}
        </button>
      </div>
    </div>
  );
}
