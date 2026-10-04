import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { BookingLifecycleError, LIFECYCLE_MESSAGES } from "./booking-lifecycle.messages";
import {
  bookingActionReasons,
  noShowDeadline,
  rentalEndFor,
  validateReschedule,
} from "./booking-lifecycle.policy";
import type { LifecycleExecutor, LifecycleMutation } from "./booking-lifecycle.types";
import type { Database } from "./client";
import {
  bookingLifecycleEvents,
  bookingRefunds,
  bookings,
  capacityAllocations,
  checkInVerifications,
  customers,
  facilities,
  facilityOperatingHours,
  payments,
  rentals,
  storageUnits,
  unitAssignments,
  unitTypes,
} from "./schema";

export async function bookingArrival(tx: LifecycleExecutor | Database, bookingId: string) {
  const [verification] = await tx
    .select({ id: checkInVerifications.id })
    .from(checkInVerifications)
    .where(
      and(
        eq(checkInVerifications.bookingId, bookingId),
        inArray(checkInVerifications.status, ["VERIFIED", "CONSUMED"]),
      ),
    );
  const [rental] = await tx
    .select({ id: rentals.id })
    .from(rentals)
    .where(and(eq(rentals.bookingId, bookingId), eq(rentals.status, "ACTIVE")));
  return { arrived: Boolean(verification), activeRental: Boolean(rental) };
}

async function clearAssignments(tx: LifecycleExecutor, bookingId: string, now: Date) {
  await tx
    .update(unitAssignments)
    .set({ status: "CANCELLED", endedAt: now, reason: LIFECYCLE_MESSAGES.assignmentEnded })
    .where(and(eq(unitAssignments.bookingId, bookingId), eq(unitAssignments.status, "ACTIVE")));
  await tx
    .update(checkInVerifications)
    .set({
      status: "INVALIDATED",
      invalidatedAt: now,
      invalidatedReason: LIFECYCLE_MESSAGES.assignmentEnded,
      updatedAt: now,
    })
    .where(
      and(
        eq(checkInVerifications.bookingId, bookingId),
        eq(checkInVerifications.status, "VERIFIED"),
      ),
    );
}

export async function transitionBooking(tx: LifecycleExecutor, input: LifecycleMutation) {
  const conditions = [eq(bookings.id, input.bookingId)];
  if (input.customerId) conditions.push(eq(bookings.customerId, input.customerId));
  const [booking] = await tx
    .select()
    .from(bookings)
    .where(and(...conditions))
    .for("update");
  if (!booking) throw new BookingLifecycleError("NOT_FOUND", 404);
  const fingerprint = JSON.stringify({
    action: input.action,
    checkInAt: input.checkInAt ? new Date(input.checkInAt).toISOString() : null,
  });
  const [event] = await tx
    .select()
    .from(bookingLifecycleEvents)
    .where(
      and(
        eq(bookingLifecycleEvents.bookingId, booking.id),
        eq(bookingLifecycleEvents.idempotencyKey, input.idempotencyKey),
      ),
    );
  if (event) {
    if (event.requestFingerprint !== fingerprint)
      throw new BookingLifecycleError("IDEMPOTENCY_KEY_REUSED");
    return event.resultSnapshot;
  }
  const arrival = await bookingArrival(tx, booking.id);
  const reasons = bookingActionReasons(booking, arrival.arrived, arrival.activeRental, input.now);
  if (reasons.length) throw new BookingLifecycleError(reasons[0] as "INVALID_BOOKING_STATE");
  const [payment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "SUCCEEDED")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!payment) throw new BookingLifecycleError("PAYMENT_NOT_SUCCEEDED");
  if (input.action === "NO_SHOW" && input.now <= noShowDeadline(booking))
    throw new BookingLifecycleError("NO_SHOW_NOT_DUE");

  let nextStart = booking.checkInSlotStart;
  let nextEnd = booking.rentalEndAt;
  let nextSlotEnd = booking.checkInSlotEnd;
  if (input.action === "RESCHEDULED") {
    nextStart = new Date(input.checkInAt ?? "");
    const invalid = validateReschedule(booking, nextStart, input.now);
    if (invalid) throw new BookingLifecycleError(invalid);
    const [context] = await tx
      .select({ active: facilities.isActive, typeActive: unitTypes.isActive })
      .from(facilities)
      .innerJoin(
        unitTypes,
        and(eq(unitTypes.facilityId, facilities.id), eq(unitTypes.id, booking.unitTypeId)),
      )
      .where(eq(facilities.id, booking.facilityId));
    if (!context?.active || !context.typeActive)
      throw new BookingLifecycleError("CONTEXT_INACTIVE");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(nextStart);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
    const [hours] = await tx
      .select()
      .from(facilityOperatingHours)
      .where(
        and(
          eq(facilityOperatingHours.facilityId, booking.facilityId),
          eq(facilityOperatingHours.dayOfWeek, weekday),
        ),
      );
    const time = `${part("hour")}:${part("minute")}:${part("second")}`;
    if (time < (hours?.openTime ?? "06:00:00") || time > (hours?.closeTime ?? "22:00:00"))
      throw new BookingLifecycleError("CHECK_IN_OUTSIDE_HOURS");
    nextEnd = rentalEndFor(nextStart, booking.requestedMonths);
    nextSlotEnd = booking.checkInSlotEnd
      ? new Date(
          nextStart.getTime() +
            booking.checkInSlotEnd.getTime() -
            booking.checkInSlotStart.getTime(),
        )
      : null;
    // Same ordered inventory locks as hold creation; allocation queries occur after acquiring them.
    const inventory = await tx
      .select({ id: storageUnits.id })
      .from(storageUnits)
      .where(
        and(
          eq(storageUnits.unitTypeId, booking.unitTypeId),
          notInArray(storageUnits.status, ["INACTIVE", "LOCKED", "MAINTENANCE"]),
        ),
      )
      .orderBy(asc(storageUnits.id))
      .for("update");
    const allocations = await tx
      .select({ id: capacityAllocations.id })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.unitTypeId, booking.unitTypeId),
          ne(capacityAllocations.referenceId, booking.id),
          eq(capacityAllocations.status, "ACTIVE"),
          lt(capacityAllocations.startsAt, nextEnd),
          gt(capacityAllocations.endsAt, nextStart),
          or(isNull(capacityAllocations.expiresAt), gt(capacityAllocations.expiresAt, input.now)),
        ),
      );
    if (allocations.length >= inventory.length)
      throw new BookingLifecycleError("CAPACITY_UNAVAILABLE");
    const updated = await tx
      .update(capacityAllocations)
      .set({ startsAt: nextStart, endsAt: nextEnd, updatedAt: input.now })
      .where(
        and(
          eq(capacityAllocations.referenceId, booking.id),
          eq(capacityAllocations.kind, "BOOKING"),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      )
      .returning({ id: capacityAllocations.id });
    if (!updated.length) throw new BookingLifecycleError("ALLOCATION_MISSING");
  } else {
    await tx
      .update(capacityAllocations)
      .set({ status: "RELEASED", updatedAt: input.now })
      .where(
        and(
          eq(capacityAllocations.referenceId, booking.id),
          eq(capacityAllocations.kind, "BOOKING"),
          eq(capacityAllocations.status, "ACTIVE"),
        ),
      );
    await tx
      .insert(bookingRefunds)
      .values({
        bookingId: booking.id,
        paymentId: payment.id,
        amount: payment.rentalFeeAmount,
        forfeitedDepositAmount: payment.depositAmount,
        currency: payment.currency,
        reason: input.action,
      })
      .onConflictDoNothing({ target: bookingRefunds.bookingId });
  }
  await clearAssignments(tx, booking.id, input.now);
  const [updated] = await tx
    .update(bookings)
    .set({
      status: input.action === "RESCHEDULED" ? "CONFIRMED" : input.action,
      checkInSlotStart: nextStart,
      checkInSlotEnd: nextSlotEnd,
      rentalEndAt: nextEnd,
      rescheduleCount: booking.rescheduleCount + (input.action === "RESCHEDULED" ? 1 : 0),
      assignedStaffId: null,
      updatedAt: input.now,
    })
    .where(eq(bookings.id, booking.id))
    .returning();
  if (!updated) throw new BookingLifecycleError("NOT_FOUND", 404);
  const [createdEvent] = await tx
    .insert(bookingLifecycleEvents)
    .values({
      bookingId: booking.id,
      actorUserId: input.actorUserId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      previousCheckInAt: booking.checkInSlotStart,
      newCheckInAt: input.action === "RESCHEDULED" ? nextStart : null,
      resultSnapshot: {},
      createdAt: input.now,
    })
    .returning();
  const result = await customerBookingSnapshot(tx, updated, input.now);
  if (!createdEvent) throw new BookingLifecycleError("NOT_FOUND", 404);
  await tx
    .update(bookingLifecycleEvents)
    .set({ resultSnapshot: result })
    .where(eq(bookingLifecycleEvents.id, createdEvent.id));
  return result;
}

export async function customerBookingSnapshot(
  tx: LifecycleExecutor | Database,
  booking: typeof bookings.$inferSelect,
  now: Date,
) {
  const [facility] = await tx
    .select()
    .from(facilities)
    .where(eq(facilities.id, booking.facilityId));
  const [unitType] = await tx.select().from(unitTypes).where(eq(unitTypes.id, booking.unitTypeId));
  if (!facility || !unitType) throw new BookingLifecycleError("NOT_FOUND", 404);
  const history = await tx
    .select()
    .from(bookingLifecycleEvents)
    .where(eq(bookingLifecycleEvents.bookingId, booking.id))
    .orderBy(asc(bookingLifecycleEvents.createdAt));
  const [refund] = await tx
    .select()
    .from(bookingRefunds)
    .where(eq(bookingRefunds.bookingId, booking.id));
  const arrival = await bookingArrival(tx, booking.id);
  const reasonCodes = bookingActionReasons(booking, arrival.arrived, arrival.activeRental, now);
  const rescheduleReason = validateReschedule(booking, new Date(now.getTime() + 86400000), now);
  return {
    id: booking.id,
    bookingCode: booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase(),
    facility: { id: facility.id, name: facility.name, address: facility.address },
    unitType: { id: unitType.id, name: unitType.name, sizeLabel: unitType.sizeLabel },
    checkInAt: booking.checkInSlotStart.toISOString(),
    checkInSlotEnd: booking.checkInSlotEnd?.toISOString() ?? null,
    rentalEndAt: booking.rentalEndAt.toISOString(),
    durationMonths: booking.requestedMonths,
    status: booking.status,
    rescheduleCount: booking.rescheduleCount,
    pricing: {
      rentalFeeAmount: booking.rentalFeeAmount,
      depositAmount: booking.depositAmount,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    },
    history: history.map((event) => ({
      action: event.action,
      at: event.createdAt.toISOString(),
      previousCheckInAt: event.previousCheckInAt.toISOString(),
      newCheckInAt: event.newCheckInAt?.toISOString() ?? null,
    })),
    refund: refund
      ? {
          status: refund.status,
          amount: refund.amount,
          forfeitedDepositAmount: refund.forfeitedDepositAmount,
          currency: refund.currency,
          simulation: refund.simulation,
        }
      : null,
    actions: {
      canCancel: reasonCodes.length === 0,
      canReschedule: reasonCodes.length === 0 && !rescheduleReason,
      reasonCodes: [...reasonCodes, ...(rescheduleReason ? [rescheduleReason] : [])],
    },
  };
}

export class BookingLifecycleRepository {
  constructor(private readonly db: Database) {}
  async customerId(userId: string) {
    const [customer] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.userId, userId));
    return customer?.id ?? null;
  }
  async list(customerId: string) {
    return this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.customerId, customerId))
      .orderBy(desc(bookings.createdAt));
  }
  async detail(bookingId: string, customerId: string) {
    const [row] = await this.db
      .select({ booking: bookings, facility: facilities, unitType: unitTypes })
      .from(bookings)
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, customerId)));
    if (!row) return null;
    const [history, refundRows, arrival] = await Promise.all([
      this.db
        .select()
        .from(bookingLifecycleEvents)
        .where(eq(bookingLifecycleEvents.bookingId, bookingId))
        .orderBy(asc(bookingLifecycleEvents.createdAt)),
      this.db.select().from(bookingRefunds).where(eq(bookingRefunds.bookingId, bookingId)),
      bookingArrival(this.db, bookingId),
    ]);
    return { ...row, history, refund: refundRows[0] ?? null, ...arrival };
  }
  async mutate(input: LifecycleMutation) {
    return this.db.transaction((tx) => transitionBooking(tx, input));
  }
  async snapshot(bookingId: string, customerId: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, customerId)))
        .for("share");
      return booking ? customerBookingSnapshot(tx, booking, now) : null;
    });
  }
  async sweepNoShow(now: Date) {
    const candidates = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "CONFIRMED"),
          sql`${bookings.paidAt} is not null`,
          sql`coalesce(${bookings.checkInSlotEnd}, ${bookings.checkInSlotStart}) + interval '2 hours' < ${now}`,
          notExists(
            this.db
              .select({ id: checkInVerifications.id })
              .from(checkInVerifications)
              .where(
                and(
                  eq(checkInVerifications.bookingId, bookings.id),
                  inArray(checkInVerifications.status, ["VERIFIED", "CONSUMED"]),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ id: rentals.id })
              .from(rentals)
              .where(and(eq(rentals.bookingId, bookings.id), eq(rentals.status, "ACTIVE"))),
          ),
        ),
      )
      .orderBy(asc(bookings.checkInSlotStart))
      .limit(100);
    let processed = 0;
    for (const candidate of candidates) {
      try {
        await this.mutate({
          bookingId: candidate.id,
          action: "NO_SHOW",
          idempotencyKey: "system-no-show",
          now,
        });
        processed++;
      } catch (error) {
        if (!(error instanceof BookingLifecycleError)) throw error;
      }
    }
    return processed;
  }
}
