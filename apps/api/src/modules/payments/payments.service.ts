import { createHash } from "node:crypto";
import type { PaidBooking, PaymentResult } from "@storex/contracts";
import type { Booking, Payment } from "@storex/database";
import { AppError, NotFoundError } from "../../common/errors/app-error";
import { MockPaymentGateway, type PaymentGateway } from "./payment-gateway";
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
    const completed = await this.repository.findCompletedByIdempotencyKey(input.idempotencyKey);
    if (completed) {
      if (!completed.payment.paidAt) throw new AppError("Payment thiếu thời điểm thanh toán", 500);
      if (!completed.booking.bookingCode || !completed.booking.paidAt)
        throw new AppError("Booking thiếu thông tin thanh toán", 500);
      return toPaymentResult(
        { ...completed.payment, paidAt: completed.payment.paidAt },
        {
          ...completed.booking,
          bookingCode: completed.booking.bookingCode,
          paidAt: completed.booking.paidAt,
        },
      );
    }

    const checkout = await this.repository.findCheckout(draftId, hashToken(input.holdToken));
    if (!checkout) throw new NotFoundError("Hold không tồn tại hoặc không còn hiệu lực");
    if (checkout.hold.expiresAt && checkout.hold.expiresAt <= new Date()) {
      throw new AppError("Hold đã hết hạn", 409, "HOLD_EXPIRED");
    }

    const pricing = await this.pricingProvider(draftId);
    if (!pricing) throw new AppError("Pricing chưa được cấu hình", 409, "PRICING_NOT_CONFIGURED");

    const gatewayResult = await this.gateway.charge({
      amount: pricing.totalAmount,
      currency: pricing.currency,
      paymentMethodToken: input.paymentMethodToken,
      idempotencyKey: input.idempotencyKey,
    });
    if (gatewayResult.status === "FAILED") {
      throw new AppError("Payment thất bại", 402, "PAYMENT_FAILED");
    }

    const completedCheckout = await this.repository.completeCheckout({
      draftId,
      holdId: checkout.hold.id,
      provider: this.gateway.provider,
      providerPaymentId: gatewayResult.providerPaymentId,
      idempotencyKey: input.idempotencyKey,
      pricing,
      paidAt: new Date(),
    });
    if (!completedCheckout) throw new AppError("Hold không còn hiệu lực", 409, "HOLD_EXPIRED");
    if (!completedCheckout.booking)
      throw new AppError("Payment đã tồn tại nhưng thiếu Booking", 500);
    if (!completedCheckout.payment.paidAt)
      throw new AppError("Payment thiếu thời điểm thanh toán", 500);
    if (!completedCheckout.booking.bookingCode || !completedCheckout.booking.paidAt)
      throw new AppError("Booking thiếu thông tin thanh toán", 500);

    return toPaymentResult(
      { ...completedCheckout.payment, paidAt: completedCheckout.payment.paidAt },
      {
        ...completedCheckout.booking,
        bookingCode: completedCheckout.booking.bookingCode,
        paidAt: completedCheckout.booking.paidAt,
      },
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
  };
}
