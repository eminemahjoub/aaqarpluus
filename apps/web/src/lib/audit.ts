import { getDataSource } from "@/lib/db/data-source";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  req?: Request;
}) {
  // fire-and-forget (no await at call site)
  void (async () => {
    try {
      const ds = await getDataSource();
      const repo = ds.getRepository("AuditLog");
      const ip =
        params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        params.req?.headers.get("x-real-ip") ??
        null;
      const ua = params.req?.headers.get("user-agent") ?? null;

      await repo.save(
        repo.create({
          user_id: params.userId ?? null,
          action: params.action,
          entity_type: params.entityType ?? null,
          entity_id: params.entityId ?? null,
          changes: params.changes ?? null,
          metadata: params.metadata ?? null,
          ip_address: ip,
          user_agent: ua,
        } as any)
      );
    } catch {
      // swallow
    }
  })();
}

