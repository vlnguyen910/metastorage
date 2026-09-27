import {
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { facilities, storageUnits, unitTypes } from "./facilities";
import { users } from "./users";

export const BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const UNIT_ASSIGNMENT_STATUSES = ["ACTIVE", "REASSIGNED", "CANCELLED"] as const;
export type UnitAssignmentStatus = (typeof UNIT_ASSIGNMENT_STATUSES)[number];

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
    contactName: varchar({ length: 150 }).notNull(),
    contactEmail: varchar({ length: 255 }).notNull(),
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
    qrToken: varchar({ length: 255 }).unique(),
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
    index("bookings_dates_idx").on(table.checkInSlotStart, table.rentalEndAt),
  ],
);

export const unitAssignments = pgTable(
  "unit_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    assignedBy: uuid()
      .notNull()
      .references(() => users.id),
    status: varchar({ length: 50 }).default("ACTIVE").notNull(),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp({ withTimezone: true }),
    reason: text(),
  },
  (table) => [
    index("unit_assignments_booking_idx").on(table.bookingId),
    index("unit_assignments_physical_unit_idx").on(table.physicalUnitId),
    index("unit_assignments_booking_status_idx").on(table.bookingId, table.status),
  ],
);

export const rentals = pgTable(
  "rentals",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .unique()
      .references(() => bookings.id),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id),
    status: varchar({ length: 50 }).default("ACTIVE").notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    expectedEndAt: timestamp({ withTimezone: true }).notNull(),
    actualReturnAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("rentals_facility_idx").on(table.facilityId),
    index("rentals_customer_idx").on(table.customerId),
    index("rentals_active_unit_idx").on(table.physicalUnitId, table.status, table.expectedEndAt),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type UnitAssignment = typeof unitAssignments.$inferSelect;
export type NewUnitAssignment = typeof unitAssignments.$inferInsert;

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;
