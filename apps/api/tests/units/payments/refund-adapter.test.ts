import { describe, expect, it } from "bun:test";
import { canSimulateRefund, MockRefundAdapter } from "../../../../worker/src/refund-adapter";

describe("Demo refunds", () => {
  it("never simulates refunds in production or live SePay", () => {
    expect(canSimulateRefund("production", "sandbox")).toBe(false);
    expect(canSimulateRefund("development", "production")).toBe(false);
    expect(canSimulateRefund(undefined, "sandbox")).toBe(false);
    expect(canSimulateRefund("development", "sandbox")).toBe(true);
  });
  it("uses the refund ID as a stable idempotency key", async () => {
    const adapter = new MockRefundAdapter();
    const input = { refundId: "refund-1", amount: "900000", currency: "VND" };
    expect(await adapter.refund(input)).toEqual(await adapter.refund(input));
  });
});
