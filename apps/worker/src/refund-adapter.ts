import type { RefundAdapter } from "./refund-adapter.types";
export function canSimulateRefund(nodeEnv: string | undefined, sepayEnv: string | undefined) {
  return ["development", "develop", "test"].includes(nodeEnv ?? "") && sepayEnv === "sandbox";
}
export class MockRefundAdapter implements RefundAdapter {
  async refund(input: { refundId: string; amount: string; currency: string }) {
    return { reference: `demo-refund-${input.refundId}` };
  }
}
