export type GatewayPaymentResult = {
  providerPaymentId: string;
  status: "SUCCEEDED" | "FAILED";
};

export type PaymentInstructions = {
  paymentCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  currency: string;
  content: string;
  expiresAt: string;
};

export type VerifiedPaymentEvent = {
  providerEventId: string;
  paymentCode: string;
  amount: number;
  transferType: "in" | "out";
  referenceCode: string | null;
  metadata: Record<string, unknown>;
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
