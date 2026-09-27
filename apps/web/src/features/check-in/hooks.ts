"use client";

import type { AssignPhysicalUnitInput } from "@storex/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const bookingKeys = {
  all: ["bookings"] as const,
  facility: (facilityId: string, status?: string) =>
    [...bookingKeys.all, "facility", facilityId, status] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
  eligibleUnits: (id: string) => [...bookingKeys.all, "eligible-units", id] as const,
};

export function useFacilityBookings(facilityId: string, status?: string) {
  return useQuery({
    queryKey: bookingKeys.facility(facilityId, status),
    queryFn: () => api.bookings.listFacilityBookings(facilityId, status),
    enabled: Boolean(facilityId),
  });
}

export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => api.bookings.get(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useEligibleUnits(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.eligibleUnits(bookingId),
    queryFn: () => api.bookings.getEligibleUnits(bookingId),
    enabled: Boolean(bookingId),
  });
}

export function useAssignPhysicalUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: AssignPhysicalUnitInput }) =>
      api.bookings.assignUnit(bookingId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
    },
  });
}
