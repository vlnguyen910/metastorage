import type { CustomerBooking } from "@metastorage/contracts";

export function bookingPollingInterval(bookings: CustomerBooking[] | undefined) {
  return bookings?.some(
    (booking) => booking.refund && ["PENDING", "PROCESSING"].includes(booking.refund.status),
  )
    ? 3_000
    : 60_000;
}
