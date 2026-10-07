import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { checkInSlots } from "./check-in-slots";
import { customers } from "./customers";
import { facilities } from "./facilities";
import { facilityUnitTypes } from "./facility-unit-types";
import { users } from "./users";

export const BOOKING_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
  "NO_SHOW",
  "CHECKED_IN",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingCode: varchar({ length: 50 }).unique(),
    customerId: uuid().references(() => customers.id),
    accessTokenHash: varchar({ length: 128 }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id),
    unitTypeId: uuid().notNull(),
    requestedMonths: integer().notNull(),
    checkInDate: date("check_in_date").notNull(),
    checkInSlotId: uuid("check_in_slot_id")
      .notNull()
      .references(() => checkInSlots.id, { onDelete: "restrict" }),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    monthlyRateSnapshot: numeric({ precision: 14, scale: 2 }).notNull(),
    rentalFeeAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    depositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    status: varchar({ length: 50 }).default("DRAFT").notNull(),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id),
    qrTokenHash: varchar({ length: 255 }).unique(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "bookings_valid_status",
      sql`${table.status} IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN')`,
    ),
    check(
      "bookings_customer_after_draft",
      sql`${table.status} = 'DRAFT' OR ${table.customerId} IS NOT NULL`,
    ),
    foreignKey({
      columns: [table.facilityId, table.unitTypeId],
      foreignColumns: [facilityUnitTypes.facilityId, facilityUnitTypes.unitTypeId],
    }).onDelete("restrict"),
    index("bookings_facility_status_idx").on(table.facilityId, table.status),
    index("bookings_customer_idx").on(table.customerId),
    index("bookings_assigned_staff_idx").on(table.assignedStaffId),
    index("bookings_dates_idx").on(table.checkInDate, table.rentalEndAt),
    index("bookings_check_in_slot_idx").on(table.checkInSlotId),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
