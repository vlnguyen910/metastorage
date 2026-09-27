import { createHash } from "node:crypto";
import type { BookingConfirmation, PaidBooking, PaymentResult } from "@storex/contracts";
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
    const holdTokenHash = hashToken(input.holdToken);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.draftId !== draftId || existing.holdTokenHash !== holdTokenHash) {
        throw new AppError(
          "Idempotency key đã được dùng cho checkout khác",
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (existing.status === "PENDING") {
        throw new AppError("Payment đang được đối soát", 409, "PAYMENT_PENDING");
      }
      if (existing.status !== "SUCCEEDED") {
        throw new AppError(
          "Payment attempt đã kết thúc, hãy tạo idempotency key mới",
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
        throw new AppError("Payment thiếu thông tin booking", 500);
      }
      return toPaymentResult(
        { ...completed.payment, paidAt: completed.payment.paidAt },
        {
          ...completed.booking,
          bookingCode: completed.booking.bookingCode,
          paidAt: completed.booking.paidAt,
        },
      );
    }

    const checkout = await this.repository.findCheckout(draftId, holdTokenHash);
    if (!checkout) throw new NotFoundError("Hold không tồn tại hoặc không còn hiệu lực");
    if (checkout.hold.expiresAt && checkout.hold.expiresAt <= new Date()) {
      throw new AppError("Hold đã hết hạn", 409, "HOLD_EXPIRED");
    }

    const pricing = await this.pricingProvider(draftId);
    if (!pricing) throw new AppError("Pricing chưa được cấu hình", 409, "PRICING_NOT_CONFIGURED");

    const pending = await this.repository.createPendingPayment({
      draftId,
      holdTokenHash,
      provider: this.gateway.provider,
      idempotencyKey: input.idempotencyKey,
      pricing,
    });
    if (!pending) throw new AppError("Hold không còn hiệu lực", 409, "HOLD_EXPIRED");
    if (pending.payment.status !== "PENDING") {
      throw new AppError("Idempotency key đã được xử lý", 409, "IDEMPOTENCY_KEY_REUSED");
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
      throw new AppError("Payment gateway trả về kết quả không xác định", 503, "PAYMENT_UNCERTAIN");
    }
    if (gatewayResult.status === "FAILED") {
      await this.repository.markFailed(pending.payment.id);
      throw new AppError("Payment thất bại", 402, "PAYMENT_FAILED");
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
      throw new AppError("Payment đã nhận nhưng đang chờ đối soát", 503, "PAYMENT_UNCERTAIN");
    }
    if (!completedCheckout?.booking) {
      throw new AppError("Payment đã nhận nhưng đang chờ đối soát", 503, "PAYMENT_UNCERTAIN");
    }
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
