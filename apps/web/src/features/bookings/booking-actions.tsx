"use client";
import type { CustomerBooking } from "@metastorage/contracts";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { BOOKING_MESSAGES as M } from "./bookings.messages";
import { useBookingActions } from "./hooks";

export function BookingActions({ booking }: { booking: CustomerBooking }) {
  const state = useBookingActions(booking);
  return (
    <section className="grid gap-5 rounded-card border border-slate-200 bg-white p-5 [&_#field-check-in-message]:text-red-700">
      {state.notice && <p role="status">{state.notice}</p>}
      {state.mutation.isError && (
        <p role="alert" className="text-red-700">
          {M.mutationError}
        </p>
      )}
      <p>{M.cancellationPolicy}</p>
      {state.confirmCancel ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={state.mutation.isPending} onClick={state.cancel}>
            {state.mutation.isPending ? M.pending : M.cancelConfirm}
          </Button>
          <Button
            type="button"
            disabled={state.mutation.isPending}
            onClick={() => state.setConfirmCancel(false)}
          >
            {M.dismiss}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          disabled={!booking.actions.canCancel || state.mutation.isPending}
          onClick={() => state.setConfirmCancel(true)}
        >
          {M.cancel}
        </Button>
      )}
      <form onSubmit={state.reschedule} noValidate className="grid gap-3">
        <h2 className="text-lg font-bold">{M.reschedule}</h2>
        <p className="text-sm">{M.reschedulePolicy}</p>
        <FieldShell label={M.checkIn} error={state.form.formState.errors.checkInAt?.message}>
          <Input
            type="datetime-local"
            disabled={!booking.actions.canReschedule || state.mutation.isPending}
            {...state.form.register("checkInAt")}
          />
        </FieldShell>
        <Button type="submit" disabled={!booking.actions.canReschedule || state.mutation.isPending}>
          {state.mutation.isPending ? M.pending : M.save}
        </Button>
      </form>
      {booking.actions.reasonCodes.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {booking.actions.reasonCodes.map((reason) => (
            <li key={reason}>{M.reasons[reason as keyof typeof M.reasons] ?? M.unavailable}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
