import { describe, it, expect } from "vitest";
import { SaudiPhoneSchema, EmailSchema, CommissionPercentSchema, UuidSchema } from "@/lib/validation";

describe("SaudiPhoneSchema", () => {
  it("accepts valid 05 numbers and normalizes them", () => {
    const result = SaudiPhoneSchema.safeParse("0501234567");
    expect(result.success).toBe(true);
    expect(result.data).toBe("+966501234567");
  });

  it("accepts +966 format", () => {
    const result = SaudiPhoneSchema.safeParse("+966501234567");
    expect(result.success).toBe(true);
    expect(result.data).toBe("+966501234567");
  });

  it("rejects invalid numbers", () => {
    expect(SaudiPhoneSchema.safeParse("12345").success).toBe(false);
    expect(SaudiPhoneSchema.safeParse("abc").success).toBe(false);
  });
});

describe("EmailSchema", () => {
  it("accepts valid emails and lowercases them", () => {
    const result = EmailSchema.safeParse("Test@Example.COM");
    expect(result.success).toBe(true);
    expect(result.data).toBe("test@example.com");
  });

  it("rejects invalid emails", () => {
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(EmailSchema.safeParse("").success).toBe(false);
  });
});

describe("CommissionPercentSchema", () => {
  it("accepts numbers between 0 and 100", () => {
    expect(CommissionPercentSchema.safeParse(15).success).toBe(true);
    expect(CommissionPercentSchema.safeParse(0).success).toBe(true);
    expect(CommissionPercentSchema.safeParse(100).success).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(CommissionPercentSchema.safeParse(-1).success).toBe(false);
    expect(CommissionPercentSchema.safeParse(101).success).toBe(false);
  });
});

describe("UuidSchema", () => {
  it("accepts valid UUIDs", () => {
    expect(UuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(UuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(UuidSchema.safeParse("").success).toBe(false);
  });
});
