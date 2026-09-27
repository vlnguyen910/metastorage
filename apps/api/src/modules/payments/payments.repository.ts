import { createHash, randomBytes } from "node:crypto";
import {
  and,
  bookingConfirmationEmails,
  bookings,
  capacityAllocations,
  customers,
  type Database,
  eq,
  facilities,
  gt,
  payments,
  reservationDrafts,
  sql,
  unitTypes,
} from "@storex/database";

export type PricingSnapshot = {
  monthlyRateSnapshot: string;
  rentalFeeAmount: string;
  depositAmount: string;
  totalAmount: string;
  currency: string;
};

function bookingCode() {
  return `SX-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function hashQrToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class PaymentsRepository {
  constructor(private readonly db: Database) {}

  async findCheckout(draftId: string, holdTokenHash: string) {
    const [checkout] = await this.db
      .select({ draft: reservationDrafts, hold: capacityAllocations })
      .from(reservationDrafts)
      .innerJoin(
        capacityAllocations,
        and(
          eq(capacityAllocations.referenceId, reservationDrafts.id),
          eq(capacityAllocations.kind, "HOLD"),
          eq(capacityAllocations.status, "ACTIVE"),
          eq(capacityAllocations.accessTokenHash, holdTokenHash),
        ),
      )
      .where(eq(reservationDrafts.id, draftId));
    return checkout;
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, idempotencyKey));
    return payment;
  }

  async findCompletedByIdempotencyKey(
    idempotencyKey: string,
    draftId: string,
    holdTokenHash: string,
  ) {
    const [result] = await this.db
      .select({ payment: payments, booking: bookings })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(
        and(
          eq(payments.idempotencyKey, idempotencyKey),
          eq(payments.draftId, draftId),
          eq(payments.holdTokenHash, holdTokenHash),
          eq(payments.status, "SUCCEEDED"),
        ),
      );
    return result;
  }

  async createPendingPayment(input: {
    draftId: string;
    holdTokenHash: string;
    provider: string;
    idempotencyKey: string;
    pricing: PricingSnapshot;
  }) {
    return this.db.transaction(async (tx) => {
      const [checkout] = await tx
        .select({ draft: reservationDrafts, hold: capacityAllocations })
        .from(reservationDrafts)
        .innerJoin(
          capacityAllocations,
          and(
            eq(capacityAllocations.referenceId, reservationDrafts.id),
            eq(capacityAllocations.kind, "HOLD"),
            eq(capacityAllocations.status, "ACTIVE"),
            eq(capacityAllocations.accessTokenHash, input.holdTokenHash),
            gt(capacityAllocations.expiresAt, new Date()),
          ),
        )
        .where(eq(reservationDrafts.id, input.draftId))
        .for("update");
      if (!checkout) return null;

      await tx
        .insert(customers)
        .values({
          fullName: checkout.draft.contactName,
          email: checkout.draft.contactEmail,
          phone: checkout.draft.contactPhone,
        })
        .onConflictDoNothing();
      const [businessCustomer] = await tx
        .select()
        .from(customers)
        .where(sql`lower(btrim(${customers.email})) = lower(btrim(${checkout.draft.contactEmail}))`)
        .for("update");
      if (!businessCustomer) throw new Error("Failed to create customer");

      const values = {
        customerId: businessCustomer.id,
        draftId: input.draftId,
        holdTokenHash: input.holdTokenHash,
        provider: input.provider,
        providerPaymentId: `pending_${input.idempotencyKey}`,
        idempotencyKey: input.idempotencyKey,
        monthlyRateSnapshot: input.pricing.monthlyRateSnapshot,
        rentalFeeAmount: input.pricing.rentalFeeAmount,
        depositAmount: input.pricing.depositAmount,
        totalAmount: input.pricing.totalAmount,
        currency: input.pricing.currency,
        status: "PENDING" as const,
      };
      const [createdPayment] = await tx
        .insert(payments)
        .values(values)
        .onConflictDoNothing({ target: payments.idempotencyKey })
        .returning();
      const [payment] = createdPayment
        ? [createdPayment]
        : await tx
            .select()
            .from(payments)
            .where(eq(payments.idempotencyKey, input.idempotencyKey))
            .for("update");
      if (!payment) throw new Error("Failed to create pending payment");
      return { payment, checkout };
    });
  }

  async markFailed(paymentId: string) {
    const [payment] = await this.db
      .update(payments)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")))
      .returning();
    return payment;
  }

  async completePendingPayment(input: {
    paymentId: string;
    providerPaymentId: string;
    draftId: string;
    holdId: string;
    paidAt: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, input.paymentId),
            eq(payments.draftId, input.draftId),
            eq(payments.status, "PENDING"),
          ),
        )
        .for("update");
      if (!payment) return null;

      const [checkout] = await tx
        .select({
          draft: reservationDrafts,
          hold: capacityAllocations,
          facility: facilities,
          unitType: unitTypes,
        })
        .from(reservationDrafts)
        .innerJoin(facilities, eq(facilities.id, reservationDrafts.facilityId))
        .innerJoin(unitTypes, eq(unitTypes.id, reservationDrafts.unitTypeId))
        .innerJoin(
          capacityAllocations,
          and(
            eq(capacityAllocations.id, input.holdId),
            eq(capacityAllocations.referenceId, reservationDrafts.id),
            eq(capacityAllocations.kind, "HOLD"),
            eq(capacityAllocations.status, "ACTIVE"),
          ),
        )
        .where(eq(reservationDrafts.id, input.draftId))
        .for("update");
      if (!checkout) return null;
      const qrToken = randomBytes(32).toString("hex");

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingCode: bookingCode(),
          customerId: payment.customerId,
          facilityId: checkout.draft.facilityId,
          unitTypeId: checkout.draft.unitTypeId,
          requestedMonths: checkout.draft.durationMonths,
          contactName: checkout.draft.contactName,
          contactEmail: checkout.draft.contactEmail,
          contactPhone: checkout.draft.contactPhone,
          checkInSlotStart: checkout.draft.checkInAt,
          rentalEndAt: checkout.draft.rentalEndAt,
          monthlyRateSnapshot: payment.monthlyRateSnapshot,
          rentalFeeAmount: payment.rentalFeeAmount,
          depositAmount: payment.depositAmount,
          totalAmount: payment.totalAmount,
          currency: payment.currency,
          qrTokenHash: hashQrToken(qrToken),
          status: "CONFIRMED",
          paidAt: input.paidAt,
        })
        .returning();
      if (!booking) throw new Error("Failed to create booking after payment");

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          bookingId: booking.id,
          providerPaymentId: input.providerPaymentId,
          status: "SUCCEEDED",
          paidAt: input.paidAt,
          updatedAt: input.paidAt,
        })
        .where(eq(payments.id, payment.id))
        .returning();
      if (!updatedPayment) throw new Error("Failed to finalize payment");

      await tx.insert(bookingConfirmationEmails).values({
        bookingId: booking.id,
        recipientEmail: checkout.draft.contactEmail,
        template: "BOOKING_CONFIRMATION",
        status: "PENDING",
      });

      await tx
        .update(capacityAllocations)
        .set({
          kind: "BOOKING",
          referenceId: booking.id,
          accessTokenHash: null,
          expiresAt: null,
          updatedAt: input.paidAt,
        })
        .where(eq(capacityAllocations.id, input.holdId));

      return {
        payment: updatedPayment,
        booking,
        confirmation: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
          qrToken,
          qrUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/check-in?token=${qrToken}`,
          facility: { name: checkout.facility.name, address: checkout.facility.address },
          checkInSlotStart: checkout.draft.checkInAt.toISOString(),
          checkInSlotEnd: null,
          rentalEndAt: checkout.draft.rentalEndAt.toISOString(),
          unitTypeName: checkout.unitType.name,
          sizeLabel: checkout.unitType.sizeLabel,
          durationMonths: checkout.draft.durationMonths,
          emailStatus: "QUEUED" as const,
        },
      };
    });
  }
}
