import {
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { facilities } from "./facilities";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export const BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingCode: varchar({ length: 50 }).unique(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    unitTypeId: uuid().notNull(),
    requestedMonths: integer().notNull(),
    rescheduleCount: integer().default(0).notNull(),
    contactName: varchar({ length: 150 }).notNull(),
    contactEmail: varchar({ length: 320 }).notNull(),
    contactPhone: varchar({ length: 30 }).notNull(),
    checkInSlotStart: timestamp({ withTimezone: true }).notNull(),
    checkInSlotEnd: timestamp({ withTimezone: true }),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    monthlyRateSnapshot: numeric({ precision: 14, scale: 2 }).notNull(),
    rentalFeeAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).default("VND").notNull(),
    status: varchar({ length: 50 }).default("CONFIRMED").notNull(),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id),
    qrTokenHash: varchar({ length: 255 }).unique(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitTypeId, table.facilityId],
      foreignColumns: [unitTypes.id, unitTypes.facilityId],
    }).onDelete("restrict"),
    index("bookings_facility_status_idx").on(table.facilityId, table.status),
    index("bookings_customer_idx").on(table.customerId),
    index("bookings_assigned_staff_idx").on(table.assignedStaffId),
    index("bookings_dates_idx").on(table.checkInSlotStart, table.rentalEndAt),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
