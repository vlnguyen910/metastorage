import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PaymentCheckoutInput } from "@storex/contracts";
import { MockPaymentGateway } from "../../../src/modules/payments/payment-gateway";
import { PaymentsService } from "../../../src/modules/payments/payments.service";

const draftId = "00000000-0000-0000-0000-000000000001";
const holdId = "00000000-0000-0000-0000-000000000002";
const customerId = "00000000-0000-0000-0000-000000000003";
const bookingId = "00000000-0000-0000-0000-000000000004";
const facilityId = "00000000-0000-0000-0000-000000000005";
const unitTypeId = "00000000-0000-0000-0000-000000000006";

const now = new Date();
const draft = {
  id: draftId,
  facilityId,
  unitTypeId,
  durationMonths: 3,
  contactName: "Guest Customer",
  contactEmail: "guest@example.com",
  contactPhone: "+84901234567",
  checkInAt: now,
  rentalEndAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
};
const hold = {
  id: holdId,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  accessTokenHash: "hash",
};

function paymentInput(overrides: Partial<PaymentCheckoutInput> = {}): PaymentCheckoutInput {
  return {
    holdToken: "a".repeat(64),
    idempotencyKey: "checkout-key-000001",
    paymentMethodToken: "success",
    ...overrides,
  };
}

function booking() {
  return {
    id: bookingId,
    bookingCode: "SX-ABC123",
    customerId,
    facilityId,
    unitTypeId,
    requestedMonths: 3,
    contactName: draft.contactName,
    contactEmail: draft.contactEmail,
    contactPhone: draft.contactPhone,
    checkInSlotStart: draft.checkInAt,
    rentalEndAt: draft.rentalEndAt,
    rentalFeeAmount: "3000000.00",
    monthlyRateSnapshot: "1000000.00",
    depositAmount: "1000000.00",
    totalAmount: "4000000.00",
    currency: "VND",
    status: "CONFIRMED" as const,
    paidAt: now,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findCompletedByIdempotencyKey: async () => undefined,
    findCheckout: async () => ({ draft, hold }),
    completeCheckout: async () => ({
      payment: {
        id: "00000000-0000-0000-0000-000000000007",
        provider: "mock",
        providerPaymentId: "mock_checkout-key-000001",
        paidAt: now,
      },
      booking: booking(),
    }),
    ...overrides,
  } as never;
}

describe("payments service", () => {
  it("creates one paid booking and returns the pricing snapshot", async () => {
    const service = new PaymentsService(repository(), new MockPaymentGateway(), async () => ({
      rentalFeeAmount: "3000000.00",
      monthlyRateSnapshot: "1000000.00",
      depositAmount: "1000000.00",
      totalAmount: "4000000.00",
      currency: "VND",
    }));

    const result = await service.pay(draftId, paymentInput());

    assert.equal(result.status, "SUCCEEDED");
    assert.equal(result.booking.status, "CONFIRMED");
    assert.equal(result.booking.customerId, customerId);
    assert.equal(result.pricing.totalAmount, "4000000.00");
  });

  it("does not pay while pricing is not configured", async () => {
    const service = new PaymentsService(repository());

    await assert.rejects(() => service.pay(draftId, paymentInput()), {
      code: "PRICING_NOT_CONFIGURED",
    });
  });

  it("does not create a booking when the gateway fails", async () => {
    let completed = false;
    const service = new PaymentsService(
      repository({
        completeCheckout: async () => {
          completed = true;
          return null;
        },
      }),
      new MockPaymentGateway(),
      async () => ({
        rentalFeeAmount: "3000000.00",
        monthlyRateSnapshot: "1000000.00",
        depositAmount: "1000000.00",
        totalAmount: "4000000.00",
        currency: "VND",
      }),
    );

    await assert.rejects(() => service.pay(draftId, paymentInput({ paymentMethodToken: "fail" })), {
      code: "PAYMENT_FAILED",
    });
    assert.equal(completed, false);
  });

  it("returns the existing booking for an idempotent retry", async () => {
    const service = new PaymentsService(
      repository({
        findCompletedByIdempotencyKey: async () => ({
          payment: {
            id: "00000000-0000-0000-0000-000000000007",
            provider: "mock",
            providerPaymentId: "mock_existing",
            paidAt: now,
          },
          booking: booking(),
        }),
      }),
      new MockPaymentGateway(),
    );

    const result = await service.pay(draftId, paymentInput());
    assert.equal(result.booking.id, bookingId);
  });
});
