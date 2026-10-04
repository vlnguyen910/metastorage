import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { payments } from "./payments";
export const bookingRefunds = pgTable(
  "booking_refunds",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    forfeitedDepositAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: varchar({ length: 3 }).notNull(),
    reason: varchar({ length: 32 }).notNull(),
    status: varchar({ length: 32 }).default("PENDING").notNull(),
    attempts: integer().default(0).notNull(),
    nextRetryAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    leaseUntil: timestamp({ withTimezone: true }),
    leaseToken: uuid(),
    providerReference: varchar({ length: 128 }),
    simulation: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("booking_refunds_pending_idx").on(t.status, t.nextRetryAt)],
);
