import {
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { customers } from "./customers";
import { reservationDrafts } from "./reservation-drafts";

export const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const;
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);

export const payments = pgTable(
  "payments",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid().references(() => bookings.id, { onDelete: "restrict" }),
    draftId: uuid()
      .notNull()
      .references(() => reservationDrafts.id, { onDelete: "restrict" }),
    holdTokenHash: varchar({ length: 128 }).notNull(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    provider: varchar({ length: 32 }).notNull(),
    paymentCode: varchar({ length: 32 }).notNull().unique(),
    providerPaymentId: varchar({ length: 128 }).notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    status: paymentStatusEnum().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
    index("payments_booking_idx").on(table.bookingId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
