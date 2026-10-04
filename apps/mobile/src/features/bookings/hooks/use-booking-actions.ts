import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "../../../lib/api";
import { bookingKeys } from "./use-bookings";

export function useBookingActions(bookingId: string) {
  const client = useQueryClient();
  // Keep keys for failed requests: a network timeout may hide a successful server mutation.
  const cancelKey = useRef<string | null>(null);
  const rescheduleAttempt = useRef<{ checkInAt: string; key: string } | null>(null);
  const newKey = () => `mobile-${bookingId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: bookingKeys.all }),
      client.invalidateQueries({ queryKey: ["rentals"] }),
    ]);
  };
  const cancel = useMutation({
    mutationFn: () => {
      cancelKey.current ??= newKey();
      return api.bookings.cancel(bookingId, { idempotencyKey: cancelKey.current });
    },
    onSuccess: async (booking) => {
      client.setQueryData(bookingKeys.detail(bookingId), booking);
      cancelKey.current = null;
      await refresh();
    },
    onError: refresh,
    retry: false,
  });
  const reschedule = useMutation({
    mutationFn: (checkInAt: string) => {
      if (rescheduleAttempt.current?.checkInAt !== checkInAt) {
        rescheduleAttempt.current = { checkInAt, key: newKey() };
      }
      return api.bookings.reschedule(bookingId, {
        checkInAt,
        idempotencyKey: rescheduleAttempt.current.key,
      });
    },
    onSuccess: async (booking) => {
      client.setQueryData(bookingKeys.detail(bookingId), booking);
      rescheduleAttempt.current = null;
      await refresh();
    },
    onError: refresh,
    retry: false,
  });
  return { cancel, reschedule, isPending: cancel.isPending || reschedule.isPending };
}
