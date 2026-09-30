import { createHash } from "node:crypto";
import type { BookingConfirmation, PaidBooking, PaymentResult } from "@metastorage/contracts";
import type { Booking, Payment } from "@metastorage/database";
import { AppError, NotFoundError } from "../../common/errors/app-error";
import { MockPaymentGateway, type PaymentGateway } from "./payment-gateway";
import { PAYMENT_MESSAGES } from "./payments.messages";
import type { PaymentsRepository, PricingSnapshot } from "./payments.repository";
import type { CheckoutPaymentBody } from "./payments.schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly gateway: PaymentGateway = new MockPaymentGateway(),
    private readonly pricingProvider: (
      draftId: string,
    ) => Promise<PricingSnapshot | null> = async () => null,
  ) {}

  async pay(draftId: string, input: CheckoutPaymentBody): Promise<PaymentResult> {
    const holdTokenHash = hashToken(input.holdToken);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.draftId !== draftId || existing.holdTokenHash !== holdTokenHash) {
        throw new AppError(
          PAYMENT_MESSAGES.idempotencyKeyUsedForAnotherCheckout,
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status === "PENDING") {
        throw new AppError(PAYMENT_MESSAGES.paymentPendingReconciliation, 409, "PAYMENT_PENDING");
      }
      if (existing.status !== "SUCCEEDED") {
        throw new AppError(
          PAYMENT_MESSAGES.paymentAttemptFinalized,
          409,
          "PAYMENT_ATTEMPT_FINALIZED",
        );
      }
      const completed = await this.repository.findCompletedByIdempotencyKey(
        input.idempotencyKey,
        draftId,
        holdTokenHash,
      );
      if (
        !completed?.payment.paidAt ||
        !completed.booking.bookingCode ||
        !completed.booking.paidAt
      ) {
        throw new AppError(PAYMENT_MESSAGES.paymentMissingBookingInformation, 500);
      }
      return toPaymentResult(
        { ...completed.payment, paidAt: completed.payment.paidAt },
        {
          ...completed.booking,
          bookingCode: completed.booking.bookingCode,
          paidAt: completed.booking.paidAt,
        },
        completed.confirmation,
      );
    }

    const checkout = await this.repository.findCheckout(draftId, holdTokenHash);
    if (!checkout) throw new NotFoundError(PAYMENT_MESSAGES.holdUnavailable);
    if (checkout.hold.expiresAt && checkout.hold.expiresAt <= new Date()) {
      throw new AppError(PAYMENT_MESSAGES.holdExpired, 409, "HOLD_EXPIRED");
    }

    const pricing = await this.pricingProvider(draftId);
    if (!pricing)
      throw new AppError(PAYMENT_MESSAGES.pricingNotConfigured, 409, "PRICING_NOT_CONFIGURED");

    const pending = await this.repository.createPendingPayment({
      draftId,
      holdTokenHash,
      provider: this.gateway.provider,
      idempotencyKey: input.idempotencyKey,
      pricing,
    });
    if (!pending) throw new AppError(PAYMENT_MESSAGES.holdNoLongerAvailable, 409, "HOLD_EXPIRED");
    if (pending.payment.status !== "PENDING") {
      throw new AppError(
        PAYMENT_MESSAGES.idempotencyKeyAlreadyProcessed,
        409,
        "IDEMPOTENCY_KEY_REUSED",
      );
    }

    const gatewayResult = await this.gateway.charge({
      amount: pricing.totalAmount,
      currency: pricing.currency,
      paymentMethodToken: input.paymentMethodToken,
      idempotencyKey: input.idempotencyKey,
    });
    if (
      !gatewayResult?.providerPaymentId ||
      !["SUCCEEDED", "FAILED"].includes(gatewayResult.status)
    ) {
      throw new AppError(PAYMENT_MESSAGES.paymentGatewayResultUnknown, 503, "PAYMENT_UNCERTAIN");
    }
    if (gatewayResult.status === "FAILED") {
      await this.repository.markFailed(pending.payment.id);
      throw new AppError(PAYMENT_MESSAGES.paymentFailed, 402, "PAYMENT_FAILED");
    }

    let completedCheckout: Awaited<ReturnType<PaymentsRepository["completePendingPayment"]>>;
    try {
      completedCheckout = await this.repository.completePendingPayment({
        paymentId: pending.payment.id,
        draftId,
        holdId: checkout.hold.id,
        providerPaymentId: gatewayResult.providerPaymentId,
        paidAt: new Date(),
      });
    } catch {
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    }
    if (!completedCheckout?.booking) {
      throw new AppError(
        PAYMENT_MESSAGES.paymentReceivedPendingReconciliation,
        503,
        "PAYMENT_UNCERTAIN",
      );
    }
    if (!completedCheckout.payment.paidAt)
      throw new AppError(PAYMENT_MESSAGES.paymentTimestampMissing, 500);
    if (!completedCheckout.booking.bookingCode || !completedCheckout.booking.paidAt)
      throw new AppError(PAYMENT_MESSAGES.bookingPaymentInformationMissing, 500);

    return toPaymentResult(
      { ...completedCheckout.payment, paidAt: completedCheckout.payment.paidAt },
      {
        ...completedCheckout.booking,
        bookingCode: completedCheckout.booking.bookingCode,
        paidAt: completedCheckout.booking.paidAt,
      },
      completedCheckout.confirmation,
    );
  }
}

function toPaymentResult(
  payment: Pick<Payment, "id" | "provider" | "providerPaymentId"> & { paidAt: Date },
  booking: Pick<
    Booking,
    | "id"
    | "bookingCode"
    | "customerId"
    | "facilityId"
    | "unitTypeId"
    | "checkInSlotStart"
    | "rentalEndAt"
    | "requestedMonths"
    | "status"
    | "paidAt"
    | "contactName"
    | "contactEmail"
    | "contactPhone"
    | "rentalFeeAmount"
    | "depositAmount"
    | "totalAmount"
    | "currency"
  > & { bookingCode: string; paidAt: Date },
  confirmation?: BookingConfirmation,
): PaymentResult {
  const result: PaidBooking = {
    id: booking.id,
    bookingCode: booking.bookingCode,
    customerId: booking.customerId,
    facilityId: booking.facilityId,
    unitTypeId: booking.unitTypeId,
    checkInAt: booking.checkInSlotStart.toISOString(),
    rentalEndAt: booking.rentalEndAt.toISOString(),
    durationMonths: booking.requestedMonths,
    status: "CONFIRMED",
    paidAt: booking.paidAt.toISOString(),
    contact: {
      fullName: booking.contactName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
    },
    pricing: {
      rentalFeeAmount: booking.rentalFeeAmount,
      depositAmount: booking.depositAmount,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    },
  };
  return {
    id: payment.id,
    status: "SUCCEEDED",
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    paidAt: payment.paidAt.toISOString(),
    pricing: result.pricing,
    booking: result,
    confirmation,
  };
}
