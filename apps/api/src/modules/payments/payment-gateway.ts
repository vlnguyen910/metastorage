import type { PaymentGateway } from "./payment-gateway.types";

export type { GatewayPaymentResult, PaymentGateway } from "./payment-gateway.types";

export class MockPaymentGateway implements PaymentGateway {
  readonly provider = "mock";

  async charge(input: {
    amount: string;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
  }) {
    return {
      providerPaymentId: `mock_${input.idempotencyKey}`,
      status:
        input.paymentMethodToken.toLowerCase() === "fail"
          ? ("FAILED" as const)
          : ("SUCCEEDED" as const),
    };
  }
}
