import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { Database } from "./client";
import { bookingRefunds } from "./schema";
export class BookingRefundsRepository {
  constructor(private readonly db: Database) {}
  async claim(now: Date) {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(bookingRefunds)
        .where(
          and(
            eq(bookingRefunds.status, "PENDING"),
            lte(bookingRefunds.nextRetryAt, now),
            or(isNull(bookingRefunds.leaseUntil), lte(bookingRefunds.leaseUntil, now)),
          ),
        )
        .orderBy(asc(bookingRefunds.nextRetryAt))
        .limit(20)
        .for("update", { skipLocked: true });
      const claims: (typeof bookingRefunds.$inferSelect)[] = [];
      for (const row of rows) {
        if (row.attempts >= 5) {
          await tx
            .update(bookingRefunds)
            .set({ status: "FAILED", leaseToken: null, leaseUntil: null, updatedAt: now })
            .where(eq(bookingRefunds.id, row.id));
          continue;
        }
        const [claimed] = await tx
          .update(bookingRefunds)
          .set({
            simulation: true,
            attempts: row.attempts + 1,
            leaseUntil: new Date(now.getTime() + 60000),
            leaseToken: randomUUID(),
            updatedAt: now,
          })
          .where(eq(bookingRefunds.id, row.id))
          .returning();
        if (claimed) claims.push(claimed);
      }
      return claims;
    });
  }
  async complete(id: string, leaseToken: string, reference: string, now: Date) {
    await this.db
      .update(bookingRefunds)
      .set({
        status: "SUCCEEDED",
        providerReference: reference,
        simulation: true,
        leaseToken: null,
        leaseUntil: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(bookingRefunds.id, id),
          eq(bookingRefunds.status, "PENDING"),
          eq(bookingRefunds.leaseToken, leaseToken),
        ),
      );
  }
  async fail(id: string, leaseToken: string, attempts: number, now: Date) {
    await this.db
      .update(bookingRefunds)
      .set({
        status: attempts >= 5 ? "FAILED" : "PENDING",
        nextRetryAt: new Date(now.getTime() + 10000 * 2 ** (attempts - 1)),
        leaseToken: null,
        leaseUntil: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(bookingRefunds.id, id),
          eq(bookingRefunds.status, "PENDING"),
          eq(bookingRefunds.leaseToken, leaseToken),
        ),
      );
  }
}
