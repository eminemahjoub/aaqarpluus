import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";
import { cookies } from "next/headers";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) return null;

  // /dashboard is for non-agency; proxy.ts redirects agencies to /agency.
  const role: "owner" | "personal" = user.userType === "personal" ? "personal" : "owner";
  return role === "personal" ? <PersonalDashboard /> : <OwnerDashboard />;
}
