import { type PaymentCheckoutInput, PaymentCheckoutInputSchema } from "@storex/contracts";
import { z } from "zod";

export const paymentDraftIdParamSchema = z.object({
  draftId: z.string().uuid(),
});

export const checkoutPaymentBodySchema = PaymentCheckoutInputSchema;
export type CheckoutPaymentBody = PaymentCheckoutInput;

export const paymentWebhookParamSchema = z.object({
  provider: z.string().min(1).max(32),
});
