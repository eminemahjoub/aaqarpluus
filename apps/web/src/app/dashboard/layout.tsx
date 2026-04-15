import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  // DashboardLayout already resolves actual role via /api/auth/me
  return <DashboardLayout role="owner">{children}</DashboardLayout>;
}

