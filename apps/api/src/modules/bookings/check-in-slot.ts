import { checkInSlots, sql } from "@metastorage/database";
import type { BookingQueryExecutor } from "./bookings.types";

export async function findLegacyCheckInSlot(executor: BookingQueryExecutor, checkInAt: Date) {
  const localTimestamp = sql`${checkInAt.toISOString()}::timestamptz at time zone 'Asia/Ho_Chi_Minh'`;
  const localDate = sql`(${localTimestamp})::date`;
  const localTime = sql`(${localTimestamp})::time`;
  const rows = await executor
    .select({
      id: checkInSlots.id,
      checkInDate: sql<string>`${localDate}::text`,
      startsAt:
        sql<Date>`(${localDate} + ${checkInSlots.startTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
          (value) => new Date(value),
        ),
      endsAt:
        sql<Date>`(${localDate} + ${checkInSlots.endTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
          (value) => new Date(value),
        ),
    })
    .from(checkInSlots)
    .where(
      sql`${checkInSlots.startTime} <= ${localTime} and ${localTime} < ${checkInSlots.endTime}`,
    )
    .limit(2);

  // Reject missing or ambiguous definitions rather than choose an arbitrary slot.
  return rows.length === 1 ? rows[0] : null;
}
