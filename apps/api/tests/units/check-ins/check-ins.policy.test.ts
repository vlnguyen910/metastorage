import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCheckInEligibility,
  getGraceEndsAt,
} from "../../../src/modules/check-ins/check-ins.policy";

const slotStart = new Date("2026-09-28T10:00:00.000Z");
const slotEnd = new Date("2026-09-28T12:00:00.000Z");

function record(overrides: Record<string, unknown> = {}) {
  return {
    bookingStatus: "CONFIRMED",
    payment: { status: "SUCCEEDED" },
    hasAssignedUnit: true,
    checkInSlotStart: slotStart,
    checkInSlotEnd: slotEnd,
    verification: null,
    ...overrides,
  };
}

describe("check-in eligibility policy", () => {
  it("accepts a paid booking during the slot and grace period", () => {
    const result = evaluateCheckInEligibility(record(), new Date("2026-09-28T13:59:59.000Z"));

    assert.equal(result.canProceed, true);
    assert.deepEqual(result.reasons, []);
    assert.equal(result.shouldMarkNoShow, false);
    assert.equal(result.graceEndsAt?.toISOString(), "2026-09-28T14:00:00.000Z");
  });

  it("rejects a booking before the check-in slot", () => {
    const result = evaluateCheckInEligibility(record(), new Date("2026-09-28T09:59:59.000Z"));

    assert.equal(result.canProceed, false);
    assert.deepEqual(result.reasons, ["TOO_EARLY"]);
    assert.equal(result.shouldMarkNoShow, false);
  });

  it("marks a confirmed booking for no-show after slot end plus two hours", () => {
    const result = evaluateCheckInEligibility(record(), new Date("2026-09-28T14:00:00.001Z"));

    assert.equal(result.canProceed, false);
    assert.deepEqual(result.reasons, ["DEADLINE_PASSED"]);
    assert.equal(result.shouldMarkNoShow, true);
  });

  it("does not guess a deadline when the slot end is missing", () => {
    const result = evaluateCheckInEligibility(
      record({ checkInSlotEnd: null }),
      new Date("2026-09-28T12:00:00.000Z"),
    );

    assert.equal(getGraceEndsAt(null), null);
    assert.equal(result.canProceed, false);
    assert.deepEqual(result.reasons, ["CHECKIN_SLOT_NOT_CONFIGURED"]);
    assert.equal(result.shouldMarkNoShow, false);
  });

  it("requires payment, an assigned unit, and a confirmed booking", () => {
    const result = evaluateCheckInEligibility(
      record({
        bookingStatus: "CANCELLED",
        payment: null,
        hasAssignedUnit: false,
      }),
      new Date("2026-09-28T11:00:00.000Z"),
    );

    assert.equal(result.canProceed, false);
    assert.deepEqual(result.reasons, [
      "INVALID_BOOKING_STATUS",
      "PAYMENT_NOT_SUCCEEDED",
      "UNIT_NOT_ASSIGNED",
    ]);
  });
});
