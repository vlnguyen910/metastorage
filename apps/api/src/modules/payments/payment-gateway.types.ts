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
