import { type PaymentCheckoutInput, PaymentCheckoutInputSchema } from "@metastorage/contracts";
import { z } from "zod";

export const paymentDraftIdParamSchema = z.object({
  draftId: z.string().uuid(),
});

export const checkoutPaymentBodySchema = PaymentCheckoutInputSchema;
export type CheckoutPaymentBody = PaymentCheckoutInput;

export const paymentWebhookParamSchema = z.object({
  provider: z.string().min(1).max(32),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid(),
});
