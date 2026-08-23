export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { ok, badRequest } from "@/lib/api-helpers";
import {
  withAuth,
  resolveContext,
  assertContractAccess,
  requireCapability,
  type ContractContext,
} from "@/lib/auth/scope";
import { ownerHidesTenantPii, paymentsByContractId, sanitizeContractForOwner } from "@/lib/owner-tenant-privacy";
import { frequencyToEnglish, frequencyToArabic } from "@/lib/validation/contracts";

/**
 * Contracts routes — scoped via @/lib/auth/scope.
 * assertContractAccess already throws AuthError(404) when the contract is
 * missing or the caller has no access, so handlers rely on ctx.contractId /
 * ctx.unitId / ctx.propertyId without re-checking existence.
 *
 * Response shape note: GET returns the contract object directly (not wrapped in
 * { data }) — the dashboard edit-contract modal reads fields from the JSON root.
 */
const CONTRACT_UPDATE_FIELDS = [
  "status",
  "start_date",
  "end_date",
  "unit_id",
  "contact_id",
  "extra",
  "rent_total_sar",
  "rent_amount_sar",
  "notes",
  "payment_frequency",
  "installments_count",
];

const contractResolver = async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await resolveContext();
  requireCapability(ctx, "contracts_mutate");
  return assertContractAccess(ctx, String((await params).id));
};

function parseBody(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function pickUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const f of CONTRACT_UPDATE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  return updates;
}

export const GET = withAuth<ContractContext, { id: string }>(
  async (_req, { params }) =>
    assertContractAccess(await resolveContext(), String((await params).id)),
  async (ctx) => {
    const ds = await getDataSource();
    const contract = await ds.getRepository("Contract").findOne({
      where: { id: ctx.contractId },
      relations: ["contact", "unit", "property"],
    });
    const payments = await ds
      .getRepository("ContractPayment")
      .find({ where: { contract_id: ctx.contractId } as any, order: { due_date: "ASC" } as any });

    if (ownerHidesTenantPii({ userType: ctx.userType })) {
      const payMap = await paymentsByContractId(ds, [ctx.contractId]);
      const safe = sanitizeContractForOwner(contract as Record<string, unknown>, payMap[ctx.contractId] ?? []);
      safe.payment_frequency = frequencyToArabic(safe.payment_frequency as string | null | undefined) as any;
      return ok(safe);
    }

    return ok({
      ...contract,
      payments,
      payment_frequency: frequencyToArabic((contract as any).payment_frequency),
    });
  }
);

export const PUT = withAuth<ContractContext, { id: string }>(contractResolver, async (ctx, req) => {
  const body = parseBody(await req.text().catch(() => ""));
  if (!body || typeof body !== "object") return badRequest("البيانات مطلوبة");

  const ds = await getDataSource();
  const repo = ds.getRepository("Contract");
  const contract = await repo.findOne({ where: { id: ctx.contractId } });

  const updates = pickUpdates(body as Record<string, unknown>);
  // Canonical English storage — map any Arabic frequency sent by the UI
  if (updates.payment_frequency != null) {
    updates.payment_frequency = frequencyToEnglish(String(updates.payment_frequency));
  }
  await repo.update(ctx.contractId, updates);

  if (Array.isArray((body as any).payments)) {
    await ds.getRepository("ContractPayment").delete({ contract_id: ctx.contractId } as any);
    const payRepo = ds.getRepository("ContractPayment");
    for (const p of (body as any).payments) {
      if (!p?.due_date || Number(p?.amount_sar) <= 0) continue;
      const payment = payRepo.create({
        contract_id: ctx.contractId,
        amount_sar: Number(p.amount_sar),
        due_date: p.due_date,
        status: p.status ?? "pending",
        notes: p.notes ?? null,
      } as any);
      await payRepo.save(payment);
    }
  }

  const updated = await repo.findOne({ where: { id: ctx.contractId } });

  // Sync property status when contract status changes
  const bodyStatus = (body as any).status;
  if (bodyStatus && (contract as any).property_id) {
    const propId = (contract as any).property_id;
    if (bodyStatus === "active") {
      await ds.getRepository("Property").update(propId, { status: "active" } as any);
    } else if (bodyStatus === "cancelled" || bodyStatus === "expired" || bodyStatus === "ended") {
      // Check if any other active contract exists for this property
      const otherActive = await ds
        .getRepository("Contract")
        .createQueryBuilder("c")
        .where("c.property_id = :propId", { propId })
        .andWhere("c.id != :contractId", { contractId: ctx.contractId })
        .andWhere("c.status = :status", { status: "active" })
        .getCount();
      if (otherActive === 0) {
        await ds.getRepository("Property").update(propId, { status: "vacant" } as any);
      }
    }
  }

  return ok(updated);
});

export const DELETE = withAuth<ContractContext, { id: string }>(contractResolver, async (ctx) => {
  const ds = await getDataSource();
  const repo = ds.getRepository("Contract");

  const contract = await repo.findOne({ where: { id: ctx.contractId } });
  if (contract && (contract as any).unit_id) {
    await ds.getRepository("Unit").update((contract as any).unit_id, { status: "vacant" } as any);
  }

  // No ON DELETE CASCADE on contract_payments.contract_id — delete explicitly.
  await ds.getRepository("ContractPayment").delete({ contract_id: ctx.contractId } as any);
  await repo.delete(ctx.contractId);
  return ok({ success: true });
});