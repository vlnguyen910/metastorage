import type { LifecycleBookingPolicy } from "./booking-lifecycle.types";
export function noShowDeadline(
  booking: Pick<LifecycleBookingPolicy, "checkInSlotStart" | "checkInSlotEnd">,
) {
  return new Date((booking.checkInSlotEnd ?? booking.checkInSlotStart).getTime() + 7200000);
}
export function bookingActionReasons(
  booking: LifecycleBookingPolicy,
  arrived: boolean,
  activeRental: boolean,
  _now: Date,
): string[] {
  const reasons: string[] = [];
  if (booking.status !== "CONFIRMED") reasons.push("INVALID_BOOKING_STATE");
  if (!booking.paidAt) reasons.push("PAYMENT_NOT_SUCCEEDED");
  if (arrived) reasons.push("ALREADY_ARRIVED");
  if (activeRental) reasons.push("RENTAL_ACTIVE");
  return reasons;
}
export function validateReschedule(booking: LifecycleBookingPolicy, checkInAt: Date, now: Date) {
  if (booking.rescheduleCount >= 2) return "RESCHEDULE_LIMIT";
  if (
    !Number.isFinite(checkInAt.getTime()) ||
    booking.checkInSlotStart.getTime() - now.getTime() < 86400000 ||
    checkInAt.getTime() - now.getTime() < 86400000
  )
    return "RESCHEDULE_TOO_LATE";
  if (checkInAt.getTime() - now.getTime() > 30 * 86400000) return "CHECK_IN_TOO_FAR";
  return null;
}
export function rentalEndFor(checkInAt: Date, months: number) {
  const end = new Date(checkInAt);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}
