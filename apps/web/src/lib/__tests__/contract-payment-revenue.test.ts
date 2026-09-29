import { describe, it, expect, vi } from "vitest";
import { syncRevenueForPayment, deleteRevenueForPayment } from "@/lib/contract-payment-revenue";

function fakeDs(existing: any = null) {
  const repo = {
    findOne: vi.fn(async () => existing),
    create: vi.fn((x: any) => ({ ...x, id: "rev-1" })),
    save: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  };
  return { ds: { getRepository: () => repo }, repo };
}

const contract = {
  id: "c-1",
  owner_id: "owner-1",
  property_id: "prop-1",
  unit_id: "unit-1",
  contact_id: "contact-1",
};

describe("syncRevenueForPayment", () => {
  it("creates a rent revenue row for a paid payment", async () => {
    const { ds, repo } = fakeDs(null);
    await syncRevenueForPayment(contract, { id: "p-1", status: "paid", amount_sar: 1500, paid_at: "2026-02-01", payment_method: "نقدي" }, ds);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: "owner-1",
        property_id: "prop-1",
        unit_id: "unit-1",
        contract_id: "c-1",
        contact_id: "contact-1",
        payment_id: "p-1",
        type: "إيجار",
        amount_sar: 1500,
        payment_method: "نقدي",
      })
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it("defaults payment_method to bank transfer when absent", async () => {
    const { ds, repo } = fakeDs(null);
    await syncRevenueForPayment(contract, { id: "p-2", status: "paid", amount_sar: 2000 }, ds);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ payment_method: "تحويل بنكي" }));
  });

  it("updates the existing revenue row instead of duplicating", async () => {
    const existing = { id: "rev-9" };
    const { ds, repo } = fakeDs(existing);
    await syncRevenueForPayment(contract, { id: "p-3", status: "paid", amount_sar: 3000, payment_method: "نقدي" }, ds);
    expect(repo.update).toHaveBeenCalledWith("rev-9", expect.objectContaining({ amount_sar: 3000 }));
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("does nothing for unpaid payments with no existing revenue", async () => {
    const { ds, repo } = fakeDs(null);
    await syncRevenueForPayment(contract, { id: "p-4", status: "pending", amount_sar: 1000 }, ds);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("deletes existing revenue when payment reverts to unpaid", async () => {
    const { ds, repo } = fakeDs({ id: "rev-7" });
    await syncRevenueForPayment(contract, { id: "p-5", status: "pending" }, ds);
    expect(repo.delete).toHaveBeenCalledWith("rev-7");
  });
});

describe("deleteRevenueForPayment", () => {
  it("deletes the revenue row linked to a payment", async () => {
    const { ds, repo } = fakeDs({ id: "rev-3" });
    await deleteRevenueForPayment("p-9", ds);
    expect(repo.delete).toHaveBeenCalledWith("rev-3");
  });

  it("is a no-op when nothing exists", async () => {
    const { ds, repo } = fakeDs(null);
    await deleteRevenueForPayment("p-9", ds);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
