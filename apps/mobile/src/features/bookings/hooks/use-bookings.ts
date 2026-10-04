import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { bookingPollingInterval } from "../refund-polling";

export const bookingKeys = {
  all: ["customer-bookings"] as const,
  mine: ["customer-bookings", "mine"] as const,
  detail: (id: string) => ["customer-bookings", "detail", id] as const,
};

export function useBookings() {
  return useQuery({
    queryKey: bookingKeys.mine,
    queryFn: () => api.bookings.mine(),
    refetchInterval: (query) => bookingPollingInterval(query.state.data),
  });
}

export function useBookingDetail(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => api.bookings.customerGet(id),
    refetchInterval: (query) =>
      bookingPollingInterval(query.state.data ? [query.state.data] : undefined),
  });
}
