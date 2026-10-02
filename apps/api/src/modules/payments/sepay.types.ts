import type { PaymentInstructions, VerifiedPaymentEvent } from "./payment-gateway.types";

export type SepayWebhookPayload = {
  id?: number | string;
  code?: string | null;
  transferType?: "in" | "out";
  transferAmount?: number;
  referenceCode?: string | null;
  notification_type?: string;
  order?: {
    order_invoice_number?: string;
    order_amount?: number;
    order_status?: string;
    [key: string]: unknown;
  };
  transaction?: {
    transaction_id?: string | number;
    transaction_amount?: number;
    payment_method?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type SepayGatewayConfig = {
  paymentPrefix: string;
  env?: "sandbox" | "production";
  merchantId?: string;
  secretKey?: string;
  webUrl?: string;
  apiKey?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  publicApiUrl?: string;
};

export type SepayCheckoutSession = {
  checkoutUrl: string;
  formFields: Record<string, string | number>;
};

export type SepayCreateCheckoutInput = {
  paymentCode: string;
  amount: number;
  currency: string;
  description: string;
  draftId: string;
  paymentId: string;
};

export type SepayPaymentInstructions = PaymentInstructions & { provider: "sepay" };
export type SepayVerifiedPaymentEvent = VerifiedPaymentEvent & { provider: "sepay" };
