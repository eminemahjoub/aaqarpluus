import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/api-helpers";
import { forbidden, unauthorized } from "@/lib/errors";

export async function assertSuperAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) throw unauthorized();
  if (String(user.userType ?? "") !== "superadmin") throw forbidden("يتطلب صلاحية Super Admin");
  return user;
}

