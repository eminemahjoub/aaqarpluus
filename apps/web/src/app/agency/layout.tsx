import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout role="agency">{children}</DashboardLayout>;
}

