import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, unauthorized, ok, serverError } from "@/lib/api-helpers";
import { assertAgencyCanAccessProperty, getAccessiblePropertyIds } from "@/lib/office-scope";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const ds = await getDataSource();
    const repo = ds.getRepository("Revenue");

    const propertyIds = await getAccessiblePropertyIds(ds, user);
    const rev = Array.isArray(propertyIds)
      ? await repo.findOne({ where: { id } as any })
      : await repo.findOne({ where: { id, owner_id: user.userId } as any });
    if (!rev) return unauthorized();
    if (Array.isArray(propertyIds)) {
      const pid = String((rev as any).property_id ?? "");
      if (!pid || !(await assertAgencyCanAccessProperty(ds, user, pid))) return unauthorized();
    }

    // Delete associated commission expense if exists
    try {
      await ds.getRepository("Expense").delete({ related_revenue_id: String(id) } as any);
    } catch {
      // ignore
    }

    await repo.delete(id);
    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
