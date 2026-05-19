import type { JwtPayload } from "@/lib/auth";

/** مكتب عقاري — صلاحيات كاملة (إنشاء / تعديل / حذف). */
export function isAgencyUser(user: Pick<JwtPayload, "userType"> | null | undefined) {
  return String(user?.userType ?? "") === "agency";
}

/** مالك. */
export function isOwnerUser(user: Pick<JwtPayload, "userType"> | null | undefined) {
  return String(user?.userType ?? "") === "owner";
}

/** إضافة/تعديل/حذف العقارات والوحدات — للمكتب فقط. */
export function canMutateProperties(user: Pick<JwtPayload, "userType"> | null | undefined) {
  return isAgencyUser(user);
}

/** باقي البيانات (مهام، جهات اتصال، عقود، مصروفات…) — المالك والمكتب. */
export function canMutateAppData(user: Pick<JwtPayload, "userType"> | null | undefined) {
  const t = String(user?.userType ?? "");
  return t === "agency" || t === "owner" || t === "personal";
}

export const OWNER_PROPERTIES_READ_ONLY_MESSAGE =
  "العقارات للعرض فقط — لا يمكنك إضافة أو تعديل العقارات. تواصل مع المكتب. يمكنك إدارة المهام والمصروفات وباقي البيانات.";

export { ownerHidesTenantPii } from "@/lib/owner-tenant-privacy";
