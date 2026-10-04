import { expect, test } from "bun:test";
import { bookingPollingInterval } from "./refund-polling";

test("list and detail poll pending refunds every three seconds", () => {
  expect(bookingPollingInterval([{ refund: { status: "PENDING" } }])).toBe(3_000);
  expect(bookingPollingInterval([{ refund: null }, { refund: { status: "PROCESSING" } }])).toBe(
    3_000,
  );
});

test("refund completion restores the normal booking refresh interval", () => {
  expect(bookingPollingInterval([{ refund: { status: "SUCCEEDED" } }])).toBe(60_000);
  expect(bookingPollingInterval([{ refund: { status: "FAILED" } }])).toBe(60_000);
  expect(bookingPollingInterval([{ refund: null }])).toBe(60_000);
  expect(bookingPollingInterval(undefined)).toBe(60_000);
});
