import { z } from "zod";

export type PageArgs = {
  page: number;
  limit: number;
  search?: string | null;
  offset: number;
};

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).optional().nullable(),
});

export function parsePagination(sp: URLSearchParams): PageArgs | null {
  // Backward compatible: only paginate when page/limit/search is provided.
  if (!sp.has("page") && !sp.has("limit") && !sp.has("search")) return null;
  const parsed = PaginationSchema.parse({
    page: sp.get("page") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    search: sp.get("search") ?? undefined,
  });
  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search ?? null,
    offset: (parsed.page - 1) * parsed.limit,
  };
}

export function paginated<T>(args: { items: T[]; total: number; page: number; limit: number; search?: string | null }) {
  const { items, total, page, limit, search } = args;
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    ...(search ? { search } : {}),
  };
}

