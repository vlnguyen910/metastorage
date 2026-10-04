import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "../../../../packages/database/node_modules/postgres";
import { BookingLifecycleRepository } from "../../../../packages/database/src/booking-lifecycle.repository";
import type { LifecycleExecutor } from "../../../../packages/database/src/booking-lifecycle.types";
import * as schema from "../../../../packages/database/src/schema";

// Import source modules directly: the database barrel initializes the normal DB client.
// No dotenv loading, DATABASE_URL fallback, migrations, public tables, or cloud secrets.
export const NOW = new Date("2026-10-01T00:00:00Z");
export const START = new Date("2026-10-05T03:00:00Z");
export const NEXT = new Date("2026-10-10T03:00:00Z");
export const END = new Date("2026-11-05T03:00:00Z");
export const NEXT_END = new Date("2026-11-10T03:00:00Z");

export async function openLifecycleDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    return { skip: "TEST_DATABASE_URL is unset; isolated PostgreSQL tests skipped" } as const;
  const namespace = `booking_lifecycle_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await admin`select 1`;
  } catch {
    await admin.end({ timeout: 1 });
    // Never print the connection URL or driver error (both can contain credentials).
    return {
      skip: "TEST_DATABASE_URL PostgreSQL is unreachable; integration tests skipped",
    } as const;
  }
  const client = postgres(url, {
    max: 8,
    connect_timeout: 3,
    onnotice: () => {},
    connection: {
      search_path: `${namespace},pg_catalog`,
      application_name: namespace,
      lock_timeout: 8000,
      statement_timeout: 15000,
    },
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  let created = false;
  async function close() {
    // Close every actor before dropping only the schema this fixture created.
    await client.end({ timeout: 2 });
    try {
      if (created) {
        assert.match(namespace, /^booking_lifecycle_test_[a-f0-9]{32}$/);
        await admin`drop schema ${admin(namespace)} cascade`;
        created = false;
      }
    } finally {
      await admin.end({ timeout: 2 });
    }
  }
  async function initialize() {
    try {
      await admin`create schema ${admin(namespace)}`;
      created = true;
      const { generateDrizzleJson, generateMigration } = await import(
        "../../../../packages/database/node_modules/drizzle-kit/api.js"
      );
      // Generate in memory so pending main-branch schema changes are included.
      // No checked-in schema or generated migration is changed by these tests.
      const statements = await generateMigration(
        generateDrizzleJson({}, undefined, undefined, "snake_case"),
        generateDrizzleJson(schema, undefined, undefined, "snake_case"),
      );
      await client.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement.replaceAll('"public".', `"${namespace}".`));
        }
      });
      const [row] = await client`select current_schema() as name`;
      assert.equal(row?.name, namespace);
    } catch (error) {
      await close();
      throw error; // Reachable DB with broken DDL is a failure, never a skip.
    }
  }
  async function waitForWaiters(count: number) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const [row] = await admin`
        select count(*)::int as count from pg_stat_activity
        where application_name = ${namespace} and cardinality(pg_blocking_pids(pid)) > 0
      `;
      if (Number(row?.count) >= count) return;
      await delay(10);
    }
    throw new Error(`Expected ${count} PostgreSQL lock waiters before releasing race barrier`);
  }
  async function contend<T>(
    lock: (tx: LifecycleExecutor) => Promise<unknown>,
    jobs: (() => Promise<T>)[],
  ) {
    let pending: Promise<PromiseSettledResult<T>[]> | undefined;
    try {
      await db.transaction(async (tx) => {
        await lock(tx);
        pending = Promise.allSettled(jobs.map((job) => job()));
        await waitForWaiters(jobs.length);
      });
      assert.ok(pending);
      return await pending;
    } finally {
      // Drain even if the barrier fails; cleanup never races running transactions.
      if (pending) await pending;
    }
  }
  return {
    db,
    repository: new BookingLifecycleRepository(db),
    initialize,
    close,
    contend,
    waitForWaiters,
  };
}

export type LifecycleDatabase = Exclude<
  Awaited<ReturnType<typeof openLifecycleDatabase>>,
  { skip: string }
>;

export async function seedLifecycle(f: LifecycleDatabase) {
  const [user] = await f.db
    .insert(schema.users)
    .values({ name: "Lifecycle customer", email: `${randomUUID()}@example.test` })
    .returning();
  const [customer] = await f.db
    .insert(schema.customers)
    .values({ userId: user.id, fullName: user.name, email: user.email, phone: "0900000000" })
    .returning();
  const [facility] = await f.db
    .insert(schema.facilities)
    .values({ code: randomUUID(), name: "Lifecycle facility", address: "Test address" })
    .returning();
  const [unitType] = await f.db
    .insert(schema.unitTypes)
    .values({
      facilityId: facility.id,
      code: "SMALL",
      name: "Small",
      sizeLabel: "Small",
      sizeSqm: 2,
      monthlyPrice: 999999,
    })
    .returning();
  const [unit] = await f.db
    .insert(schema.storageUnits)
    .values({ facilityId: facility.id, unitTypeId: unitType.id, code: randomUUID() })
    .returning();
  const [draft] = await f.db
    .insert(schema.reservationDrafts)
    .values({
      facilityId: facility.id,
      unitTypeId: unitType.id,
      checkInAt: START,
      rentalEndAt: END,
      durationMonths: 1,
      contactName: user.name,
      contactEmail: user.email,
      contactPhone: customer.phone,
    })
    .returning();
  const [booking] = await f.db
    .insert(schema.bookings)
    .values({
      customerId: customer.id,
      facilityId: facility.id,
      unitTypeId: unitType.id,
      requestedMonths: 1,
      contactName: user.name,
      contactEmail: user.email,
      contactPhone: customer.phone,
      checkInSlotStart: START,
      checkInSlotEnd: new Date(START.getTime() + 3600000),
      rentalEndAt: END,
      monthlyRateSnapshot: "777.00",
      rentalFeeAmount: "888.00",
      depositAmount: "999.00",
      totalAmount: "1887.00",
      paidAt: NOW,
      assignedStaffId: user.id,
    })
    .returning();
  const [payment] = await f.db
    .insert(schema.payments)
    .values({
      bookingId: booking.id,
      draftId: draft.id,
      holdTokenHash: randomUUID(),
      customerId: customer.id,
      provider: "TEST",
      paymentCode: randomUUID().slice(0, 32),
      providerPaymentId: randomUUID(),
      idempotencyKey: randomUUID(),
      monthlyRateSnapshot: "100.00",
      rentalFeeAmount: "100.00",
      depositAmount: "25.00",
      totalAmount: "125.00",
      currency: "VND",
      status: "SUCCEEDED",
      paidAt: NOW,
    })
    .returning();
  const [allocation] = await f.db
    .insert(schema.capacityAllocations)
    .values({
      facilityId: facility.id,
      unitTypeId: unitType.id,
      referenceId: booking.id,
      kind: "BOOKING",
      startsAt: START,
      endsAt: END,
    })
    .returning();
  const [assignment] = await f.db
    .insert(schema.unitAssignments)
    .values({ bookingId: booking.id, physicalUnitId: unit.id, assignedBy: user.id })
    .returning();
  return {
    user,
    customer,
    facility,
    unitType,
    unit,
    draft,
    booking,
    payment,
    allocation,
    assignment,
  };
}

export type LifecycleSeed = Awaited<ReturnType<typeof seedLifecycle>>;

export async function snapshot(f: LifecycleDatabase, s: LifecycleSeed) {
  const [booking] = await f.db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, s.booking.id));
  const allocations = await f.db
    .select()
    .from(schema.capacityAllocations)
    .where(eq(schema.capacityAllocations.referenceId, s.booking.id));
  const assignments = await f.db
    .select()
    .from(schema.unitAssignments)
    .where(eq(schema.unitAssignments.bookingId, s.booking.id));
  const verifications = await f.db
    .select()
    .from(schema.checkInVerifications)
    .where(eq(schema.checkInVerifications.bookingId, s.booking.id));
  const refunds = await f.db
    .select()
    .from(schema.bookingRefunds)
    .where(eq(schema.bookingRefunds.bookingId, s.booking.id));
  const events = await f.db
    .select()
    .from(schema.bookingLifecycleEvents)
    .where(eq(schema.bookingLifecycleEvents.bookingId, s.booking.id))
    .orderBy(asc(schema.bookingLifecycleEvents.createdAt));
  return { booking, allocations, assignments, verifications, refunds, events };
}

export const lockBooking = (s: LifecycleSeed) => (tx: LifecycleExecutor) =>
  tx.select().from(schema.bookings).where(eq(schema.bookings.id, s.booking.id)).for("update");
export const lockInventory = (s: LifecycleSeed) => (tx: LifecycleExecutor) =>
  tx
    .select()
    .from(schema.storageUnits)
    .where(eq(schema.storageUnits.unitTypeId, s.unitType.id))
    .orderBy(asc(schema.storageUnits.id))
    .for("update");

// Competing actors model the shared lock protocols without importing API barrels
// that instantiate the normal DATABASE_URL client. These are protocol integration
// tests, not end-to-end coverage of the hold/check-in services.
export async function verifyArrival(tx: LifecycleExecutor, s: LifecycleSeed) {
  const [booking] = await lockBooking(s)(tx);
  if (booking.status !== "CONFIRMED") return false;
  await tx.insert(schema.checkInVerifications).values({
    bookingId: s.booking.id,
    facilityId: s.facility.id,
    staffId: s.user.id,
    unitAssignmentId: s.assignment.id,
    status: "VERIFIED",
  });
  return true;
}

export async function createCompetingHold(f: LifecycleDatabase, s: LifecycleSeed) {
  // Main explicitly permits this lazy barrel initialization. The repository is
  // injected with the isolated db; the normal queryClient never executes SQL.
  const { ReservationsRepository } = await import(
    "../../src/modules/reservations/reservations.repository"
  );
  const token = randomUUID();
  await f.db
    .update(schema.reservationDrafts)
    .set({ checkInAt: NEXT, rentalEndAt: NEXT_END, accessTokenHash: token })
    .where(eq(schema.reservationDrafts.id, s.draft.id));
  return Boolean(await new ReservationsRepository(f.db).createHold(s.draft.id, token));
}
