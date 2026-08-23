"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth-fetch";
import { DocumentUploader } from "@/components/documents/DocumentUploader";

type Doc = {
  id: string;
  file_name: string;
  public_url: string | null;
  mime_type: string | null;
  created_at: string;
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ar-SA");
}

export function DocumentList({ propertyId }: { propertyId: string }) {
  const { data, isLoading, refetch } = useQuery<Doc[]>({
    queryKey: ["property-documents", propertyId],
    queryFn: async () => {
      const res = await authFetch(`/api/documents?property_id=${encodeURIComponent(propertyId)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(propertyId),
  });

  const docs = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          المستندات ({docs.length})
        </h3>
      </div>

      <DocumentUploader propertyId={propertyId} onUpload={() => refetch()} />

      {isLoading && <Skeleton className="h-16" />}
      {!isLoading && docs.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
          لا توجد مستندات مرفوعة
        </p>
      )}
      <ul className="space-y-1">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
          >
            <a
              href={d.public_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
              title={d.file_name}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{d.file_name}</span>
            </a>
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {fmtDate(d.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}