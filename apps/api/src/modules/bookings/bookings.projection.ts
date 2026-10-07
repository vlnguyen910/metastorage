import {
  bookings,
  checkInSlots,
  customers,
  getTableColumns,
  payments,
  sql,
} from "@metastorage/database";

// Keep legacy API timestamps while the database stores a local date and a slot.
export const bookingCheckInSlotStart = sql<Date>`(
  ${bookings.checkInDate} + (
    select ${checkInSlots.startTime} from ${checkInSlots}
    where ${checkInSlots.id} = ${bookings.checkInSlotId}
  )
) at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

export const bookingCheckInSlotEnd = sql<Date>`(
  ${bookings.checkInDate} + (
    select ${checkInSlots.endTime} from ${checkInSlots}
    where ${checkInSlots.id} = ${bookings.checkInSlotId}
  )
) at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) => new Date(value));

export const bookingPaidAt = sql<Date | null>`(
  select min(${payments.paidAt}) from ${payments}
  where ${payments.bookingId} = ${bookings.id}
    and ${payments.status} in ('SUCCEEDED', 'REFUNDED')
)`.mapWith((value) => (value === null ? null : new Date(value)));

// Queries using this projection must join customers on bookings.customerId.
export const bookingReadFields = {
  ...getTableColumns(bookings),
  customerId: customers.id,
  contactName: customers.fullName,
  contactEmail: customers.email,
  contactPhone: customers.phone,
  checkInSlotStart: bookingCheckInSlotStart,
  checkInSlotEnd: bookingCheckInSlotEnd,
  paidAt: bookingPaidAt,
};
