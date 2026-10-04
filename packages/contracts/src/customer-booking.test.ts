import { describe, expect, it } from "vitest";
import { CancelBookingInputSchema, RescheduleBookingInputSchema } from "./customer-booking";

describe("customer booking inputs", () => {
  it("rejects changes to price, facility, unit type and duration", () => {
    for (const field of ["facilityId", "unitTypeId", "durationMonths", "totalAmount"]) {
      expect(
        RescheduleBookingInputSchema.safeParse({
          idempotencyKey: "retry-1",
          checkInAt: "2026-10-10T09:00:00+07:00",
          [field]: "changed",
        }).success,
      ).toBe(false);
      expect(
        CancelBookingInputSchema.safeParse({ idempotencyKey: "retry-1", [field]: "changed" })
          .success,
      ).toBe(false);
    }
  });
  it("requires a key and an explicit timezone", () => {
    expect(CancelBookingInputSchema.safeParse({ idempotencyKey: "a".repeat(128) }).success).toBe(
      true,
    );
    expect(CancelBookingInputSchema.safeParse({ idempotencyKey: "a".repeat(129) }).success).toBe(
      false,
    );
    expect(CancelBookingInputSchema.safeParse({ idempotencyKey: " " }).success).toBe(false);
    expect(
      RescheduleBookingInputSchema.safeParse({
        idempotencyKey: "retry-1",
        checkInAt: "2026-10-10T09:00:00",
      }).success,
    ).toBe(false);
    expect(
      RescheduleBookingInputSchema.parse({
        idempotencyKey: "retry-1",
        checkInAt: "2026-10-10T09:00:00+07:00",
      }).checkInAt,
    ).toContain("+07:00");
  });
});
