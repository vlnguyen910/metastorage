import { describe, expect, test } from "bun:test";
import { BOOKING_MESSAGES } from "./booking.messages";
import { rescheduleFormSchema, toCheckInAt } from "./booking.schema";
import { formatBookingDate, formatBookingMoney } from "./booking-format";

describe("customer reschedule input", () => {
  test("rejects dates normalized by JavaScript and malformed times", () => {
    expect(rescheduleFormSchema.safeParse({ date: "2099-02-30", time: "10:00" }).success).toBe(
      false,
    );
    expect(rescheduleFormSchema.safeParse({ date: "2099-03-01", time: "24:00" }).success).toBe(
      false,
    );
    expect(rescheduleFormSchema.safeParse({ date: "2099-03-01", time: "9:00" }).success).toBe(
      false,
    );
  });

  test("rejects past input and accepts a valid future date", () => {
    expect(rescheduleFormSchema.safeParse({ date: "2000-01-01", time: "10:00" }).success).toBe(
      false,
    );
    expect(rescheduleFormSchema.safeParse({ date: "2099-03-01", time: "10:00" }).success).toBe(
      true,
    );
  });

  test("sends Vietnam time as the correct instant including date rollover", () => {
    expect(toCheckInAt("2099-03-01", "01:30")).toBe("2099-02-28T18:30:00.000Z");
  });
});

describe("booking presentation", () => {
  test("renders decimal-string contract amounts in their currency", () => {
    expect(formatBookingMoney("1250000", "VND")).toContain("1.250.000");
    expect(formatBookingMoney("12.50", "USD")).toContain("12,50");
  });

  test("handles nullable slot end and labels Vietnam dates", () => {
    expect(formatBookingDate(null)).toBe(BOOKING_MESSAGES.unavailableDate);
    expect(formatBookingDate("2099-02-28T18:30:00.000Z")).toContain("01:30");
  });
});
