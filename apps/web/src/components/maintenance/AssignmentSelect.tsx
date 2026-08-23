"use client";

import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { authLabelClass } from "@/components/auth/auth-input-classes";

type OfficeMember = {
  id: string;
  email: string;
  full_name: string | null;
  user_type: string | null;
};

/**
 * Office-member assignment dropdown for maintenance tasks.
 * Members load from /api/offices/members (session-scoped — the API derives
 * the office from the caller's JWT, not from the query param).
 */
export function AssignmentSelect({
  officeId,
  value,
  onChange,
  disabled,
}: {
  officeId: string;
  value?: string | null;
  onChange: (memberId: string | null) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useQuery<OfficeMember[]>({
    queryKey: ["office-members", officeId],
    queryFn: async () => {
      const res = await authFetch(`/api/offices/members?officeId=${encodeURIComponent(officeId)}`);
      if (!res.ok) throw new Error("فشل تحميل أعضاء المكتب");
      return res.json();
    },
    enabled: Boolean(officeId),
  });

  const members = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-1.5">
      <label className={authLabelClass}>
        <span className="inline-flex items-center gap-1.5">
          <User className="h-4 w-4" />
          تعيين إلى
        </span>
      </label>
      <Select
        value={value ?? ""}
        onValueChange={(v) => onChange(v === "" ? null : v)}
        disabled={disabled}
        placeholder={isLoading ? "جاري التحميل..." : "اختر العضو"}
      >
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="">غير معين</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.full_name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}