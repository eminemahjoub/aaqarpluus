import type { JwtPayload } from "@/lib/auth";
import { jsonResponse } from "@/lib/errors";
import { canMutateProperties, OWNER_PROPERTIES_READ_ONLY_MESSAGE } from "@/lib/permissions";
import { ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";

export const OWNER_TENANT_CONTRACTS_READ_ONLY_MESSAGE =
  "إدارة المستأجرين والعقود والسداد للمكتب فقط — يمكنك متابعة المواعيد المتبقية للعقد والتحصيل.";

/** يُرجع 403 إذا كان المالك يحاول تعديل العقارات/الوحدات (للمكتب فقط). */
export function denyIfOwnerCannotMutateProperties(user: JwtPayload): Response | null {
  if (canMutateProperties(user)) return null;
  return jsonResponse({ error: OWNER_PROPERTIES_READ_ONLY_MESSAGE, code: "FORBIDDEN" }, 403);
}

/** يُرجع 403 إذا كان المالك يحاول إدارة عقود/مستأجرين/دفعات (للمكتب فقط). */
export function denyIfOwnerCannotManageTenantContracts(user: JwtPayload): Response | null {
  if (!ownerHidesTenantPii(user)) return null;
  return jsonResponse({ error: OWNER_TENANT_CONTRACTS_READ_ONLY_MESSAGE, code: "FORBIDDEN" }, 403);
}
