import { cookies } from "next/headers";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { AgencyDashboard } from "@/components/dashboard/AgencyDashboard";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) return null;

  const role: "owner" | "agency" | "personal" =
    user.userType === "agency" ? "agency" : user.userType === "personal" ? "personal" : "owner";

  return (
    <DashboardLayout role={role}>
      {role === "owner" && <OwnerDashboard />}
      {role === "agency" && <AgencyDashboard />}
      {role === "personal" && <PersonalDashboard />}
    </DashboardLayout>
  );
}
