"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Users,
  FolderOpen,
  BarChart3,
  UserCircle,
  Phone,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
interface DashboardSidebarProps {
  onClose?: () => void;
  role?: "owner" | "agency" | "personal";
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ownerMenuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "العقارات", icon: Building2 },
  { href: "/dashboard/tasks", label: "المهام", icon: ClipboardList },
  { href: "/dashboard/contacts", label: "جهات الاتصال", icon: Users },
  { href: "/dashboard/documents", label: "المستندات", icon: FolderOpen },
  { href: "/dashboard/reports", label: "التقارير", icon: BarChart3 },
  { href: "/dashboard/profile", label: "الملف الشخصي", icon: UserCircle },
  { href: "/dashboard/contact", label: "تواصل معنا", icon: Phone },
];

const agencyMenuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "العقارات", icon: Building2 },
  { href: "/dashboard/clients", label: "العملاء", icon: Users },
  { href: "/dashboard/documents", label: "المستندات", icon: FolderOpen },
  { href: "/dashboard/reports", label: "التقارير", icon: BarChart3 },
  { href: "/dashboard/profile", label: "الملف الشخصي", icon: UserCircle },
];

const personalMenuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "عقاراتي", icon: Building2 },
  { href: "/dashboard/profile", label: "الملف الشخصي", icon: UserCircle },
];

export function DashboardSidebar({ 
  onClose, 
  role = "personal",
  collapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const menuItems =
    role === "owner" ? ownerMenuItems : role === "agency" ? agencyMenuItems : personalMenuItems;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#1B5E3C] to-[#144d30]">
      {/* Header with Logo */}
      <div className={`flex h-16 items-center justify-between border-b border-white/10 ${collapsed ? 'px-2' : 'px-4'}`}>
        <Link href="/" className={`flex items-center gap-2 text-lg font-bold text-white ${collapsed ? 'justify-center w-full' : ''}`}>
          <img 
            src="/logo.png" 
            alt="عقار بلس" 
            className={`rounded-lg object-contain ${collapsed ? 'h-10 w-10' : 'h-9 w-9'}`}
          />
          {!collapsed && <span>عقار بلس</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Collapse Toggle Button (Desktop only) */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center py-2 border-b border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition"
        title={collapsed ? "توسيع القائمة" : "طي القائمة"}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Menu items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent/20 text-accent shadow-sm"
                  : "text-white/90 hover:bg-white/10 hover:text-white",
                collapsed ? "justify-center px-2" : "",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors flex-shrink-0",
                  isActive
                    ? "bg-accent text-white"
                    : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronLeft className="h-4 w-4 text-accent" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
