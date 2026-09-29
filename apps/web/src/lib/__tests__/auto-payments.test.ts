import { describe, it, expect } from "vitest";
import { generatePaymentSchedule } from "@/lib/auto-payments";

describe("generatePaymentSchedule", () => {
  it("returns [] for missing or invalid inputs", () => {
    expect(generatePaymentSchedule({ rent_total_sar: 0, start_date: "2026-01-01", end_date: "2026-12-31", payment_frequency: "monthly", installments_count: null })).toEqual([]);
    expect(generatePaymentSchedule({ rent_total_sar: -5, start_date: "2026-01-01", end_date: "2026-12-31", payment_frequency: "monthly", installments_count: null })).toEqual([]);
    expect(generatePaymentSchedule({ rent_total_sar: 12000, start_date: "", end_date: "2026-12-31", payment_frequency: "monthly", installments_count: null })).toEqual([]);
    expect(generatePaymentSchedule({ rent_total_sar: 12000, start_date: "not-a-date", end_date: "2026-12-31", payment_frequency: "monthly", installments_count: null })).toEqual([]);
  });

  it("splits rent evenly across explicit installments_count", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 10000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      payment_frequency: "quarterly",
      installments_count: 4,
    });
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.status === "pending")).toBe(true);
    const total = items.reduce((a, b) => a + b.amount_sar, 0);
    expect(total).toBeCloseTo(10000, 2);
  });

  it("absorbs rounding error into the last installment", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 10000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      payment_frequency: "monthly",
      installments_count: 3,
    });
    expect(items).toHaveLength(3);
    expect(items[0].amount_sar).toBe(3333.33);
    expect(items[1].amount_sar).toBe(3333.33);
    expect(items[2].amount_sar).toBe(3333.34);
    expect(items.reduce((a, b) => a + b.amount_sar, 0)).toBeCloseTo(10000, 2);
  });

  it("infers monthly installments from contract length when count omitted", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 12000,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      payment_frequency: "monthly",
      installments_count: null,
    });
    // ~12 months → 12 installments, due dates advance monthly from start
    expect(items.length).toBeGreaterThanOrEqual(11);
    expect(items.length).toBeLessThanOrEqual(13);
    expect(items[0].due_date).toBe("2026-01-01");
    expect(items[1].due_date).toBe("2026-02-01");
    expect(items.reduce((a, b) => a + b.amount_sar, 0)).toBeCloseTo(12000, 2);
  });

  it("produces a single installment for yearly frequency", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 50000,
      start_date: "2026-03-01",
      end_date: "2027-03-01",
      payment_frequency: "yearly",
      installments_count: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].amount_sar).toBe(50000);
    expect(items[0].due_date).toBe("2026-03-01");
  });

  it("quarterly due dates advance by 3 months", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 12000,
      start_date: "2026-01-15",
      end_date: "2026-12-31",
      payment_frequency: "quarterly",
      installments_count: 4,
    });
    expect(items.map((i) => i.due_date)).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("marks the last installment in notes", () => {
    const items = generatePaymentSchedule({
      rent_total_sar: 4000,
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      payment_frequency: "monthly",
      installments_count: 4,
    });
    expect(items[3].notes).toBe("القسط الأخير");
    expect(items[0].notes).toBe("قسط 1/4");
  });
});
