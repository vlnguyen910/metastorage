import type { Booking, Database } from "@metastorage/database";

export type BookingQueryExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type BookingReadRecord = Booking & {
  customerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  checkInSlotStart: Date;
  checkInSlotEnd: Date;
  paidAt: Date | null;
};
