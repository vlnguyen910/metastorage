"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CustomerBooking } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { checkInKeys, bookingKeys as staffBookingKeys } from "@/features/check-in/hooks";
import { facilityKeys } from "@/features/facilities/hooks";
import { rentalKeys } from "@/features/rentals/hooks";
import { api } from "@/lib/api";
import { BOOKING_MESSAGES as M } from "./bookings.messages";

export const bookingKeys = {
  all: ["customer-bookings"] as const,
  mine: ["customer-bookings", "mine"] as const,
  detail: (id: string) => ["customer-bookings", "detail", id] as const,
};
export function useMyBookings() {
  return useQuery({
    queryKey: bookingKeys.mine,
    queryFn: api.bookings.mine,
    refetchInterval: (query) =>
      query.state.data?.some((booking) => booking.refund?.status === "PENDING") ? 3000 : false,
  });
}
export function useCustomerBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => api.bookings.customerGet(id),
    refetchInterval: (query) => (query.state.data?.refund?.status === "PENDING" ? 3000 : false),
  });
}
const formSchema = z.object({
  checkInAt: z
    .string()
    .refine((value) => value.length > 0 && Number.isFinite(Date.parse(value)), M.invalidDate),
});

export function useBookingActions(booking: CustomerBooking) {
  const cache = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { checkInAt: "" },
  });
  const mutation = useMutation({
    mutationFn: (input: { action: "cancel" | "reschedule"; checkInAt?: string }) => {
      const fingerprint = JSON.stringify(input);
      if (request.current?.fingerprint !== fingerprint)
        request.current = { fingerprint, key: crypto.randomUUID() };
      const idempotencyKey = request.current.key;
      return input.action === "cancel"
        ? api.bookings.cancel(booking.id, { idempotencyKey })
        : api.bookings.reschedule(booking.id, { idempotencyKey, checkInAt: input.checkInAt ?? "" });
    },
    onMutate: () => setNotice(""),
    onSuccess: async (updated) => {
      request.current = null;
      cache.setQueryData(bookingKeys.detail(booking.id), updated);
      setConfirmCancel(false);
      form.reset();
      setNotice(M.updated);
      await Promise.all(
        [
          bookingKeys.all,
          rentalKeys.all,
          staffBookingKeys.all,
          checkInKeys.all,
          facilityKeys.all,
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
    },
    onError: async () => {
      await cache.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
  return {
    form,
    mutation,
    notice,
    confirmCancel,
    setConfirmCancel,
    cancel: () => mutation.mutate({ action: "cancel" }),
    reschedule: form.handleSubmit((input) =>
      mutation.mutate({ action: "reschedule", checkInAt: new Date(input.checkInAt).toISOString() }),
    ),
  };
}
