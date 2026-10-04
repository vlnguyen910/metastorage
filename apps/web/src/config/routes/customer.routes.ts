export const customerRoutes = {
  dashboard: "/customer/dashboard",
  bookings: "/customer/bookings",
  booking: (bookingId: string) => `/customer/bookings/${bookingId}`,
  facilities: "/customer/facilities",
  reservations: "/customer/reservations",
  newReservation: "/reservations/new",
  reservation: (reservationId: string) => `/customer/reservations/${reservationId}`,
  rentals: "/customer/storage",
  rental: (rentalId: string) => `/customer/storage/${rentalId}`,
} as const;
