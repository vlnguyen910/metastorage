"use client";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { BOOKING_MESSAGES as M } from "@/features/bookings/bookings.messages";
import { useMyBookings } from "@/features/bookings/hooks";
import { formatDateTime } from "@/lib/format";

export function CustomerBookingsScreen() {
  const query = useMyBookings();
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{M.title}</h1>
      {query.isPending ? (
        <LoadingState label={M.loading} />
      ) : query.isError ? (
        <ErrorState message={M.loadError} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title={M.empty} description={M.emptyDescription} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {query.data.map((booking) => (
            <li key={booking.id} className="rounded-card border border-slate-200 bg-white p-5">
              <Link
                href={customerRoutes.booking(booking.id)}
                className="inline-flex min-h-11 items-center font-bold text-primary underline focus-visible:outline-2"
              >
                {booking.bookingCode}
              </Link>
              <p>{booking.facility.name}</p>
              <p>
                {booking.unitType.name} · {booking.unitType.sizeLabel}
              </p>
              <p>
                {M.checkIn}: {formatDateTime(booking.checkInAt)}
              </p>
              <p>{M.statuses[booking.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
