import { createHmac } from "node:crypto";
import {
  and,
  bookingConfirmationEmails,
  bookings,
  capacityAllocations,
  db,
  eq,
  facilities,
  lt,
  lte,
  queryClient,
  sql,
  unitTypes,
} from "@metastorage/database";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { sweepNoShow, sweepRefunds } from "./booking-lifecycle.jobs";
import { MockMailAdapter } from "./mail-adapter";

const queueName = "capacity-hold-expiry";
const emailQueueName = "booking-confirmation-email";
const MAX_EMAIL_ATTEMPTS = 5;
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const queue = new Queue(queueName, { connection: redis });
const emailQueue = new Queue(emailQueueName, { connection: redis });
const lifecycleQueue = new Queue("booking-lifecycle", { connection: redis });
const lifecycleWorker = new Worker(
  "booking-lifecycle",
  async (job) => (job.name === "refunds" ? sweepRefunds() : sweepNoShow()),
  { connection: redis },
);
await lifecycleQueue.upsertJobScheduler(
  "booking-no-show-sweep",
  { every: 30000 },
  { name: "no-show", data: {} },
);
await lifecycleQueue.upsertJobScheduler(
  "booking-refund-sweep",
  { every: 10000 },
  { name: "refunds", data: {} },
);
lifecycleWorker.on("failed", (job, error) =>
  console.error(`Booking lifecycle job failed (${job?.id})`, error),
);

const worker = new Worker(
  queueName,
  async () => {
    const now = new Date();
    const expired = await db
      .update(capacityAllocations)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(capacityAllocations.kind, "HOLD"),
          eq(capacityAllocations.status, "ACTIVE"),
          lte(capacityAllocations.expiresAt, now),
        ),
      )
      .returning({ id: capacityAllocations.id });
    return { expired: expired.length };
  },
  { connection: redis },
);

await queue.upsertJobScheduler(
  "capacity-hold-expiry-sweep",
  { every: 30_000 },
  { name: "sweep-expired-holds", data: {} },
);

worker.on("completed", (job, result) => {
  if (result.expired > 0) console.log(`Expired ${result.expired} capacity holds (${job.id})`);
});
worker.on("failed", (job, error) => {
  console.error(`Capacity hold expiry job failed (${job?.id ?? "unknown"})`, error);
});

const emailWorker = new Worker(
  emailQueueName,
  async () => {
    const mailAdapter = new MockMailAdapter();
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          email: bookingConfirmationEmails,
          booking: bookings,
          facility: facilities,
          unitType: unitTypes,
        })
        .from(bookingConfirmationEmails)
        .innerJoin(bookings, eq(bookings.id, bookingConfirmationEmails.bookingId))
        .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
        .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
        .where(
          and(
            eq(bookingConfirmationEmails.status, "PENDING"),
            lt(bookingConfirmationEmails.attempts, MAX_EMAIL_ATTEMPTS),
          ),
        )
        .orderBy(bookingConfirmationEmails.createdAt)
        .limit(20)
        .for("update", { of: bookingConfirmationEmails, skipLocked: true });
      const now = new Date();
      for (const row of rows) {
        await tx
          .update(bookingConfirmationEmails)
          .set({ attempts: sql`${bookingConfirmationEmails.attempts} + 1`, updatedAt: now })
          .where(eq(bookingConfirmationEmails.id, row.email.id));
      }
      return rows;
    });

    for (const email of claimed) {
      try {
        const now = new Date();
        const sent = await mailAdapter.sendBookingConfirmation({
          recipientEmail: email.email.recipientEmail,
          bookingCode: email.booking.bookingCode,
          facilityName: email.facility.name,
          unitTypeName: email.unitType.name,
          qrUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/check-in?token=${createHmac(
            "sha256",
            process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
          )
            .update(email.booking.id)
            .digest("hex")}`,
        });
        await db
          .update(bookingConfirmationEmails)
          .set({
            status: "SENT",
            providerMessageId: sent.providerMessageId,
            sentAt: now,
            updatedAt: now,
          })
          .where(eq(bookingConfirmationEmails.id, email.email.id));
      } catch (error) {
        await db
          .update(bookingConfirmationEmails)
          .set({
            status: email.email.attempts >= MAX_EMAIL_ATTEMPTS ? "FAILED" : "PENDING",
            lastError: String(error),
            updatedAt: new Date(),
          })
          .where(eq(bookingConfirmationEmails.id, email.email.id));
      }
    }
    return { processed: claimed.length };
  },
  { connection: redis },
);

await emailQueue.upsertJobScheduler(
  "booking-confirmation-email-sweep",
  { every: 10_000 },
  { name: "send-booking-confirmation", data: {} },
);

async function shutdown() {
  await lifecycleWorker.close();
  await lifecycleQueue.close();
  await worker.close();
  await emailWorker.close();
  await queue.close();
  await emailQueue.close();
  await redis.quit();
  await queryClient.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
