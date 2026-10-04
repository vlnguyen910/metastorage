import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { users } from "./users";
export const bookingLifecycleEvents = pgTable(
  "booking_lifecycle_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: varchar({ length: 32 }).notNull(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    requestFingerprint: varchar({ length: 255 }).notNull(),
    resultSnapshot: jsonb().notNull(),
    previousCheckInAt: timestamp({ withTimezone: true }).notNull(),
    newCheckInAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("booking_lifecycle_idempotency_idx").on(t.bookingId, t.idempotencyKey),
    index("booking_lifecycle_booking_idx").on(t.bookingId),
  ],
);
