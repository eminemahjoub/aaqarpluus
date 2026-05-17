import type { JwtPayload } from "@/lib/auth";
import { jsonResponse } from "@/lib/errors";
import { canMutateProperties, OWNER_PROPERTIES_READ_ONLY_MESSAGE } from "@/lib/permissions";

/** يُرجع 403 إذا كان المالك يحاول تعديل العقارات/الوحدات (للمكتب فقط). */
export function denyIfOwnerCannotMutateProperties(user: JwtPayload): Response | null {
  if (canMutateProperties(user)) return null;
  return jsonResponse({ error: OWNER_PROPERTIES_READ_ONLY_MESSAGE, code: "FORBIDDEN" }, 403);
}
