import { describe, expect, it } from "vitest";
import {
  AssignPhysicalUnitInputSchema,
  CustomerSignUpInputSchema,
  ReservationQuoteSchema,
  SessionSchema,
  UserRole,
} from "./index";

describe("shared contracts", () => {
  it("accepts a valid authenticated session", () => {
    const parsed = SessionSchema.safeParse({
      user: {
        id: "user-1",
        name: "Nguyễn Minh Anh",
        email: "customer@storex.vn",
        role: UserRole.STORAGE_CUSTOMER,
        permissions: [],
        assignedFacilityIds: [],
      },
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-09-19T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("uses the same role values as the database authorization model", () => {
    expect(UserRole.STORAGE_CUSTOMER).toBe("CUSTOMER");
    expect(UserRole.BUSINESS_OPERATIONS_MANAGER).toBe("BUSINESS_OPERATION_MANAGER");
    expect(UserRole.SYSTEM_ADMINISTRATOR).toBe("SYSTEM_ADMIN");
  });

  it("normalizes and validates customer sign-up input", () => {
    const parsed = CustomerSignUpInputSchema.safeParse({
      name: " Nguyễn Minh Anh ",
      email: " CUSTOMER@STOREX.VN ",
      phone: " +84901234567 ",
      password: "correct-horse-battery",
      confirmPassword: "correct-horse-battery",
      callbackTarget: "web",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Nguyễn Minh Anh");
      expect(parsed.data.email).toBe("customer@storex.vn");
      expect(parsed.data.phone).toBe("+84901234567");
    }
  });

  it.each([
    [{ name: "", email: "customer@storex.vn", phone: "+84901234567" }, "missing name"],
    [{ name: "Customer", email: "bad-email", phone: "+84901234567" }, "invalid email"],
    [{ name: "Customer", email: "customer@storex.vn", phone: "" }, "missing phone"],
    [{ name: "Customer", email: "customer@storex.vn", phone: "x".repeat(33) }, "long phone"],
  ])("rejects sign-up with %s", (fields) => {
    const parsed = CustomerSignUpInputSchema.safeParse({
      name: "Customer",
      email: "customer@storex.vn",
      phone: "+84901234567",
      password: "correct-horse-battery",
      confirmPassword: "correct-horse-battery",
      callbackTarget: "web",
      ...Object.fromEntries(Object.entries(fields)),
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects mismatched passwords and unsupported verification callback targets", () => {
    const base = {
      name: "Customer",
      email: "customer@storex.vn",
      phone: "+84901234567",
      password: "correct-horse-battery",
      confirmPassword: "different-password",
      callbackTarget: "web",
    };

    expect(CustomerSignUpInputSchema.safeParse(base).success).toBe(false);
    expect(
      CustomerSignUpInputSchema.safeParse({ ...base, callbackTarget: "https://evil.example" })
        .success,
    ).toBe(false);
  });

  it("rejects quote durations outside the MVP policy", () => {
    const parsed = ReservationQuoteSchema.safeParse({
      id: "quote-1",
      facilityId: "facility-1",
      unitType: "Kho tiêu chuẩn",
      sizeLabel: "2 m²",
      startDate: "2026-10-01",
      durationMonths: 13,
      monthlyPrice: 900_000,
      rentalTotal: 11_700_000,
      depositAmount: 900_000,
      totalEstimated: 12_600_000,
      expiresAt: "2026-09-19T00:15:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates AssignPhysicalUnitInputSchema correctly", () => {
    const valid = AssignPhysicalUnitInputSchema.safeParse({
      physicalUnitId: "123e4567-e89b-12d3-a456-426614174000",
      reason: "Gán ô kho gần cửa ra vào theo yêu cầu khách",
    });
    expect(valid.success).toBe(true);

    const invalid = AssignPhysicalUnitInputSchema.safeParse({
      physicalUnitId: "not-a-uuid",
    });
    expect(invalid.success).toBe(false);
  });
});
