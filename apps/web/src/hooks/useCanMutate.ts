"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

export function useCanMutate() {
  const [canMutateProperties, setCanMutateProperties] = useState(false);
  const [canMutate, setCanMutate] = useState(false);
  const [userType, setUserType] = useState<"owner" | "agency" | "personal" | "superadmin" | "">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/auth/me");
        if (!res.ok) return;
        const me = await res.json();
        const t = String(me?.userType ?? "");
        if (cancelled) return;
        setUserType(t as typeof userType);
        setCanMutateProperties(t === "agency");
        setCanMutate(t === "agency" || t === "owner" || t === "personal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    /** المكتب فقط — عقارات ووحدات */
    canMutateProperties,
    /** المالك + المكتب — مهام، عقود، جهات اتصال… */
    canMutate,
    loading,
    userType,
    isOwner: userType === "owner",
    isAgency: userType === "agency",
  };
}
