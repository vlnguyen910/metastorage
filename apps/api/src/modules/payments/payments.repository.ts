import { randomBytes } from "node:crypto";
import {
  and,
  bookings,
  capacityAllocations,
  customers,
  type Database,
  eq,
  payments,
  reservationDrafts,
  sql,
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

  async findCompletedByIdempotencyKey(idempotencyKey: string) {
    const [result] = await this.db
      .select({ payment: payments, booking: bookings })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(payments.idempotencyKey, idempotencyKey));
    return result;
  }

  async completeCheckout(input: {
    draftId: string;
    holdId: string;
    provider: string;
    providerPaymentId: string;
    idempotencyKey: string;
    pricing: PricingSnapshot;
    paidAt: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, input.idempotencyKey))
        .for("update");
      if (existing)
        return {
          payment: existing,
          booking: existing.bookingId ? await this.findBooking(tx, existing.bookingId) : null,
        };

      const [checkout] = await tx
        .select({ draft: reservationDrafts, hold: capacityAllocations })
        .from(reservationDrafts)
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

      const now = input.paidAt;
      const [customer] = await tx
        .select()
        .from(customers)
        .where(sql`lower(btrim(${customers.email})) = lower(btrim(${checkout.draft.contactEmail}))`)
        .for("update");
      const businessCustomer =
        customer ??
        (
          await tx
            .insert(customers)
            .values({
              fullName: checkout.draft.contactName,
              email: checkout.draft.contactEmail,
              phone: checkout.draft.contactPhone,
            })
            .returning()
        )[0];
      if (!businessCustomer) throw new Error("Failed to create customer");

      const [payment] = await tx
        .insert(payments)
        .values({
          customerId: businessCustomer.id,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          idempotencyKey: input.idempotencyKey,
          rentalFeeAmount: input.pricing.rentalFeeAmount,
          depositAmount: input.pricing.depositAmount,
          totalAmount: input.pricing.totalAmount,
          currency: input.pricing.currency,
          status: "SUCCEEDED",
          paidAt: now,
        })
        .returning();
      if (!payment) throw new Error("Failed to create payment");

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingCode: bookingCode(),
          customerId: businessCustomer.id,
          facilityId: checkout.draft.facilityId,
          unitTypeId: checkout.draft.unitTypeId,
          requestedMonths: checkout.draft.durationMonths,
          contactName: checkout.draft.contactName,
          contactEmail: checkout.draft.contactEmail,
          contactPhone: checkout.draft.contactPhone,
          checkInSlotStart: checkout.draft.checkInAt,
          rentalEndAt: checkout.draft.rentalEndAt,
          rentalFeeAmount: input.pricing.rentalFeeAmount,
          depositAmount: input.pricing.depositAmount,
          totalAmount: input.pricing.totalAmount,
          monthlyRateSnapshot: input.pricing.monthlyRateSnapshot,
          currency: input.pricing.currency,
          status: "CONFIRMED",
          paidAt: now,
        })
        .returning();
      if (!booking) throw new Error("Failed to create booking");

      await tx
        .update(payments)
        .set({ bookingId: booking.id, updatedAt: now })
        .where(eq(payments.id, payment.id));
      await tx
        .update(capacityAllocations)
        .set({
          kind: "BOOKING",
          referenceId: booking.id,
          accessTokenHash: null,
          expiresAt: null,
          updatedAt: now,
        })
        .where(eq(capacityAllocations.id, input.holdId));

      return { payment: { ...payment, bookingId: booking.id }, booking };
    });
  }

  private async findBooking(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    bookingId: string,
  ) {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
    return booking ?? null;
  }
}
