"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";

interface UserMenuProps {
  user: {
    email?: string;
    fullName?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const displayName = user.fullName || user.email || "المستخدم";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium transition hover:bg-muted/80"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
          {initials}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-white shadow-lg dark:bg-gray-900">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {displayName}
              </p>
              {user.email && (
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {user.email}
                </p>
              )}
            </div>
            <div className="p-1">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                لوحة التحكم
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {loggingOut ? "جاري الخروج…" : "تسجيل الخروج"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
