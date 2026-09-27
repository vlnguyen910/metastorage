export type GatewayPaymentResult = {
  providerPaymentId: string;
  status: "SUCCEEDED" | "FAILED";
};

export interface PaymentGateway {
  readonly provider: string;
  charge(input: {
    amount: string;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
  }): Promise<GatewayPaymentResult>;
}

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
