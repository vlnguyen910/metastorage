import {
  and,
  bookingConfirmationEmails,
  bookings,
  capacityAllocations,
  db,
  eq,
  facilities,
  lte,
  queryClient,
  unitTypes,
} from "@storex/database";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { MockMailAdapter } from "./mail-adapter";

const queueName = "capacity-hold-expiry";
const emailQueueName = "booking-confirmation-email";
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const queue = new Queue(queueName, { connection: redis });
const emailQueue = new Queue(emailQueueName, { connection: redis });

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
    const [email] = await db
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
      .where(eq(bookingConfirmationEmails.status, "PENDING"))
      .limit(1);
    if (!email) return { sent: false };

    const now = new Date();
    await db
      .update(bookingConfirmationEmails)
      .set({ attempts: email.email.attempts + 1, updatedAt: now })
      .where(eq(bookingConfirmationEmails.id, email.email.id));

    const sent = await mailAdapter.sendBookingConfirmation({
      recipientEmail: email.email.recipientEmail,
      bookingCode: email.booking.bookingCode,
      facilityName: email.facility.name,
      unitTypeName: email.unitType.name,
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
    return { sent: true };
  },
  { connection: redis },
);

await emailQueue.upsertJobScheduler(
  "booking-confirmation-email-sweep",
  { every: 10_000 },
  { name: "send-booking-confirmation", data: {} },
);

async function shutdown() {
  await worker.close();
  await emailWorker.close();
  await queue.close();
  await emailQueue.close();
  await redis.quit();
  await queryClient.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
