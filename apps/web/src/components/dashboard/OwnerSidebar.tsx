"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  MessageSquare,
  Users,
  FolderOpen,
  BarChart3,
  UserCircle,
  Phone,
  UserPlus,
  User,
  Zap,
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

interface DashboardMenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const ownerMenuItems: DashboardMenuItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "العقارات", icon: Building2 },
  { href: "/dashboard/tasks", label: "المهام", icon: ClipboardList },
  { href: "/dashboard/messages", label: "الرسائل", icon: MessageSquare },
  { href: "/dashboard/contacts", label: "جهات الاتصال", icon: Users, disabled: true },
  { href: "/dashboard/documents", label: "المستندات", icon: FolderOpen },
  { href: "/dashboard/agencies", label: "المكاتب", icon: Users },
  { href: "/dashboard/reports", label: "التقارير", icon: BarChart3 },
  { href: "/dashboard/profile", label: "الملف الشخصي", icon: UserCircle },
  { href: "/dashboard/contact", label: "تواصل معنا", icon: Phone },
];

const agencyMenuItems: DashboardMenuItem[] = [
  { href: "/agency", label: "المكتب", icon: LayoutDashboard },
  { href: "/agency/automation", label: "الأتمتة", icon: Zap, disabled: true },
  { href: "/agency/owners", label: "الملاك", icon: Users },
  { href: "/agency/renters", label: "المستأجرين", icon: User },
  { href: "/agency/members", label: "الموظفين", icon: UserPlus },
  { href: "/agency/properties", label: "العقارات", icon: Building2 },
  { href: "/agency/messages", label: "الرسائل", icon: MessageSquare },
  { href: "/agency/contacts", label: "جهات الاتصال", icon: Users, disabled: true },
  { href: "/agency/documents", label: "المستندات", icon: FolderOpen },
  { href: "/agency/reports", label: "التقارير", icon: BarChart3 },
  { href: "/agency/profile", label: "الملف الشخصي", icon: UserCircle },
];

const personalMenuItems: DashboardMenuItem[] = [
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

      {/* Collapse Toggle Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center py-2 border-b border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition"
        title={collapsed ? "توسيع القائمة" : "طي القائمة"}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Menu items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard" || item.href === "/agency"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                onClose?.();
              }}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-emerald-900/30 text-[#f5c542] shadow-sm"
                  : "text-white/90 hover:bg-white/10 hover:text-white",
                collapsed ? "justify-center px-2" : "",
              ].join(" ")}
              title={collapsed ? item.label : undefined}
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors flex-shrink-0",
                  isActive
                    ? "bg-[#f5c542] text-[#1B5E3C]"
                    : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronLeft className="h-4 w-4 text-[#f5c542]" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
