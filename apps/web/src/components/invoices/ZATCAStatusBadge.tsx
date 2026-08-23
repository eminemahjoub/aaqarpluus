import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  generated: { variant: "amber", label: "بانتظار الإرسال" },
  signed: { variant: "blue", label: "موقع" },
  reported: { variant: "green", label: "مُبلَّغ" },
  warning: { variant: "amber", label: "مُبلَّغ مع تحذير" },
  error: { variant: "red", label: "فشل الإرسال" },
  cancelled: { variant: "gray", label: "ملغي" },
};

export function ZATCAStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const s = STATUS_MAP[status] ?? { variant: "gray" as BadgeVariant, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}