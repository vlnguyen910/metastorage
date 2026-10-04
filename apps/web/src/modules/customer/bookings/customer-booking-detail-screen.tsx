"use client";
import Link from "next/link";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { BookingActions } from "@/features/bookings/booking-actions";
import { BOOKING_MESSAGES as M } from "@/features/bookings/bookings.messages";
import { useCustomerBooking } from "@/features/bookings/hooks";
import { formatDateTime } from "@/lib/format";

export function CustomerBookingDetailScreen({ bookingId }: { bookingId: string }) {
  const query = useCustomerBooking(bookingId);
  const booking = query.data;
  return (
    <div className="grid gap-5">
      <Link
        className="inline-flex min-h-11 items-center text-primary underline focus-visible:outline-2"
        href={customerRoutes.bookings}
      >
        {M.back}
      </Link>
      <h1 className="text-2xl font-bold">{M.detail}</h1>
      {query.isPending ? (
        <LoadingState label={M.loading} />
      ) : query.isError || !booking ? (
        <ErrorState message={M.loadError} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <section className="grid gap-3 rounded-card border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-bold">{booking.bookingCode}</h2>
            <p>{M.statuses[booking.status]}</p>
            <p>{booking.facility.name}</p>
            <p>{booking.facility.address}</p>
            <p>
              {booking.unitType.name} · {booking.unitType.sizeLabel}
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                [M.checkIn, formatDateTime(booking.checkInAt)],
                [M.rentalEnd, formatDateTime(booking.rentalEndAt)],
                [M.duration, booking.durationMonths],
                [M.rentalFee, `${booking.pricing.rentalFeeAmount} ${booking.pricing.currency}`],
                [M.deposit, `${booking.pricing.depositAmount} ${booking.pricing.currency}`],
                [M.total, `${booking.pricing.totalAmount} ${booking.pricing.currency}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-bold">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <BookingActions booking={booking} />
          {booking.refund && (
            <section className="grid gap-2 rounded-card border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">{M.refund}</h2>
              <p role="status">{M.refundStatuses[booking.refund.status]}</p>
              <p>
                {M.refundAmount}: {booking.refund.amount} {booking.refund.currency}
              </p>
              <p>
                {M.forfeited}: {booking.refund.forfeitedDepositAmount} {booking.refund.currency}
              </p>
              {booking.refund.simulation && <p>{M.simulation}</p>}
            </section>
          )}
          {booking.history.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{M.history}</h2>
              <ol className="grid gap-3">
                {booking.history.map((event) => (
                  <li
                    key={`${event.at}-${event.action}-${event.previousCheckInAt}-${event.newCheckInAt}`}
                    className="rounded-card border border-slate-200 bg-white p-4"
                  >
                    <p>
                      {event.action} · {formatDateTime(event.at)}
                    </p>
                    {event.previousCheckInAt && <p>{formatDateTime(event.previousCheckInAt)}</p>}
                    {event.newCheckInAt && <p>{formatDateTime(event.newCheckInAt)}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
