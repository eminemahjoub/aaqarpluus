"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  ScrollText,
  Settings,
  BarChart3,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const items: Item[] = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/admin/users", label: "المستخدمين", icon: Users },
  { href: "/admin/offices", label: "المكاتب", icon: Building2 },
  { href: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard },
  { href: "/admin/audit-logs", label: "سجل النشاط", icon: ScrollText },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
  { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
];

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const Nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#C5A021] shadow-sm" />
          <div className="text-right">
            <div className="text-sm font-extrabold text-white">AaqarPlus</div>
            <div className="text-[11px] text-emerald-100">Super Admin</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="md:hidden rounded-lg p-2 text-emerald-100 hover:bg-white/10"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3">
        <div className="rounded-3xl bg-white/10 p-2">
          {items.map((it) => {
            const active = pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href));
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cls(
                  "group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-emerald-50 hover:bg-white/10"
                )}
              >
                <ChevronLeft className={cls("h-4 w-4", active ? "text-emerald-800" : "text-emerald-200 group-hover:text-emerald-100")} />
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{it.label}</span>
                  <Icon className={cls("h-4 w-4", active ? "text-emerald-800" : "text-emerald-200 group-hover:text-emerald-100")} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto px-4 pb-4 pt-6 text-xs text-emerald-100/80">
        <div className="rounded-2xl bg-white/10 p-3">لوحة إدارة المنصة</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-4 right-4 z-50 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#C5A021] p-3 text-white shadow-lg"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop */}
      <aside className="hidden md:block md:w-[280px] md:shrink-0">
        <div className="h-full rounded-[28px] bg-gradient-to-b from-[#0f2b1e] via-[#0b2418] to-[#071a11] shadow-[0_20px_50px_-30px_rgba(16,185,129,0.45)] ring-1 ring-white/10">
          {Nav}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-[320px] rounded-l-[28px] bg-gradient-to-b from-[#0f2b1e] via-[#0b2418] to-[#071a11] shadow-xl ring-1 ring-white/10">
            {Nav}
          </div>
        </div>
      ) : null}
    </>
  );
}

