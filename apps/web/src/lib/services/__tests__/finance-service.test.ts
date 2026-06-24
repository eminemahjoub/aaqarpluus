import { describe, it, expect, vi } from "vitest";
import { createRevenue } from "../finance-service";

const mockUser = {
  userId: "owner-1",
  email: "test@example.com",
  userType: "owner",
  officeId: null,
};

const savedRevenues: any[] = [];

const ds = {
  getRepository: (name: string) => {
    if (name === "Property") {
      return {
        findOne: vi.fn(() =>
          Promise.resolve({
            id: "prop-1",
            owner_id: "owner-1",
            managing_office_id: null,
            commission_percent: 10,
          })
        ),
      };
    }
    if (name === "Revenue") {
      return {
        create: vi.fn((payload: any) => payload),
        save: vi.fn((payload: any) => {
          savedRevenues.push(payload);
          return Promise.resolve({ id: "rev-1", ...payload });
        }),
      };
    }
    if (name === "Expense") {
      return {
        findOne: vi.fn(() => Promise.resolve(null)),
        create: vi.fn((payload: any) => payload),
        save: vi.fn((payload: any) => Promise.resolve({ id: "exp-1", ...payload })),
      };
    }
    return {
      findOne: vi.fn(() => Promise.resolve(null)),
    };
  },
  query: vi.fn(() => Promise.resolve([])),
} as any;

describe("createRevenue", () => {
  it("creates a revenue and saves unit, contact, payment method", async () => {
    const revenue = await createRevenue({
      ds,
      user: mockUser,
      body: {
        property_id: "prop-1",
        unit_id: "unit-1",
        contact_id: "contact-1",
        payment_method: "bank_transfer",
        amount_sar: 1000,
        type: "rent",
        description: "Monthly rent",
      },
    });

    expect(revenue.property_id).toBe("prop-1");
    expect(revenue.unit_id).toBe("unit-1");
    expect(revenue.contact_id).toBe("contact-1");
    expect(revenue.payment_method).toBe("bank_transfer");
    expect(revenue.amount_sar).toBe(1000);
  });

  it("throws when property_id is missing", async () => {
    await expect(
      createRevenue({
        ds,
        user: mockUser,
        body: {
          amount_sar: 1000,
        },
      })
    ).rejects.toThrow("معرف العقار مطلوب");
  });
});
