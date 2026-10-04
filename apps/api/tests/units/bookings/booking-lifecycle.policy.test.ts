import { describe, expect, it } from "bun:test";
import {
  bookingActionReasons,
  noShowDeadline,
  validateReschedule,
} from "../../../../../packages/database/src/booking-lifecycle.policy";

const now = new Date("2026-10-04T02:00:00Z");
const booking = {
  status: "CONFIRMED",
  paidAt: now,
  checkInSlotStart: new Date("2026-10-06T02:00:00Z"),
  checkInSlotEnd: null,
  rescheduleCount: 0,
};
describe("Booking lifecycle policy", () => {
  it("uses selected check-in time when slot end is absent", () => {
    expect(noShowDeadline(booking).toISOString()).toBe("2026-10-06T04:00:00.000Z");
  });
  it("blocks actions after verified arrival and active rental", () => {
    expect(bookingActionReasons(booking, true, false, now)).toContain("ALREADY_ARRIVED");
    expect(bookingActionReasons(booking, false, true, now)).toContain("RENTAL_ACTIVE");
  });
  it("allows exactly 24 hours, rejects below 24 hours and over 30 days", () => {
    expect(validateReschedule(booking, new Date(now.getTime() + 86400000), now)).toBeNull();
    expect(validateReschedule(booking, new Date(now.getTime() + 86400000 - 1), now)).toBe(
      "RESCHEDULE_TOO_LATE",
    );
    expect(validateReschedule(booking, new Date(now.getTime() + 31 * 86400000), now)).toBe(
      "CHECK_IN_TOO_FAR",
    );
  });
  it("rejects a third reschedule and terminal booking", () => {
    expect(
      validateReschedule({ ...booking, rescheduleCount: 2 }, booking.checkInSlotStart, now),
    ).toBe("RESCHEDULE_LIMIT");
    expect(bookingActionReasons({ ...booking, status: "NO_SHOW" }, false, false, now)).toContain(
      "INVALID_BOOKING_STATE",
    );
  });
});
