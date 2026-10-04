import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after as afterAll, before as beforeAll, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { BookingLifecycleError } from "../../../../packages/database/src/booking-lifecycle.messages";
import { transitionBooking } from "../../../../packages/database/src/booking-lifecycle.repository";
import type { LifecycleMutation } from "../../../../packages/database/src/booking-lifecycle.types";
import { BookingRefundsRepository } from "../../../../packages/database/src/booking-refunds.repository";
import {
  bookingRefunds,
  bookings,
  capacityAllocations,
  checkInVerifications,
  payments,
  unitTypes,
} from "../../../../packages/database/src/schema";
import {
  createCompetingHold,
  type LifecycleDatabase,
  type LifecycleSeed,
  lockBooking,
  lockInventory,
  NEXT,
  NEXT_END,
  NOW,
  openLifecycleDatabase,
  START,
  seedLifecycle,
  snapshot,
  verifyArrival,
} from "./booking-lifecycle.fixture";

// Run: bun test apps/api/tests/integration/booking-lifecycle.test.ts
// Set TEST_DATABASE_URL explicitly to a disposable PostgreSQL database. Missing or
// unreachable DB skips visibly; DDL/assertion failures on a reachable DB fail.
// Lifecycle source imports avoid normal client initialization. The competing hold
// repository lazily imports the barrel, but receives only the isolated fixture db.
const opened = await openLifecycleDatabase();
const skipReason = "skip" in opened ? opened.skip : undefined;
if (skipReason) console.warn(`[booking-lifecycle integration] ${skipReason}`);

function test(name: string, run: () => Promise<void>, timeout = 15_000) {
  it(name, { timeout, skip: skipReason }, run);
}

function mutation(s: LifecycleSeed, overrides: Partial<LifecycleMutation> = {}): LifecycleMutation {
  return {
    bookingId: s.booking.id,
    customerId: s.customer.id,
    actorUserId: s.user.id,
    action: "CANCELLED",
    idempotencyKey: randomUUID(),
    now: NOW,
    ...overrides,
  };
}

function lifecycleError(code: BookingLifecycleError["code"]) {
  return (error: unknown) => error instanceof BookingLifecycleError && error.code === code;
}

function oneWinner<T>(results: PromiseSettledResult<T>[], code: BookingLifecycleError["code"]) {
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const loser = results.find((r) => r.status === "rejected");
  assert.ok(loser?.status === "rejected");
  assert.ok(lifecycleError(code)(loser.reason));
}

describe("booking lifecycle — isolated PostgreSQL", () => {
  let f: LifecycleDatabase;
  beforeAll(
    async () => {
      if (skipReason) return;
      assert.ok(!("skip" in opened));
      f = opened;
      await f.initialize();
    },
    { timeout: 30_000 },
  );
  afterAll(async () => {
    if (f) await f.close();
  });

  test("sweeper respects the strict slot-end deadline, records a refund, and is repeatable", async () => {
    const s = await seedLifecycle(f);
    assert.ok(s.booking.checkInSlotEnd);
    const deadline = new Date(s.booking.checkInSlotEnd.getTime() + 7200000);
    assert.equal(await f.repository.sweepNoShow(deadline), 0);
    assert.equal(await f.repository.sweepNoShow(new Date(deadline.getTime() + 1)), 1);
    assert.equal(await f.repository.sweepNoShow(new Date(deadline.getTime() + 2)), 0);
    const state = await snapshot(f, s);
    assert.equal(state.booking.status, "NO_SHOW");
    assert.equal(state.allocations[0].status, "RELEASED");
    assert.equal(state.assignments[0].status, "CANCELLED");
    assert.equal(state.refunds.length, 1);
    assert.equal(state.refunds[0].reason, "NO_SHOW");
    assert.equal(state.refunds[0].amount, "100.00");
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0].idempotencyKey, "system-no-show");
  });

  test("cancellation persists one refund from the succeeded payment snapshot, forfeits deposit, and clears assignments", async () => {
    const s = await seedLifecycle(f);
    // Mutable catalog and booking prices deliberately differ from the paid snapshot.
    await f.db
      .update(unitTypes)
      .set({ monthlyPrice: 1234567 })
      .where(eq(unitTypes.id, s.unitType.id));
    const request = mutation(s);
    const result = await f.db.transaction((tx) => transitionBooking(tx, request));
    assert.ok(result && typeof result === "object" && "refund" in result);
    assert.deepEqual(result.refund, {
      status: "PENDING",
      amount: "100.00",
      forfeitedDepositAmount: "25.00",
      currency: "VND",
      simulation: false,
    });
    assert.ok(
      "facility" in result && "pricing" in result && "history" in result && "actions" in result,
    );
    const state = await snapshot(f, s);
    assert.equal(state.booking.status, "CANCELLED");
    assert.equal(state.booking.assignedStaffId, null);
    assert.equal(state.allocations[0].status, "RELEASED");
    assert.equal(state.assignments[0].status, "CANCELLED");
    assert.deepEqual(state.assignments[0].endedAt, NOW);
    assert.equal(state.refunds.length, 1);
    assert.equal(state.refunds[0].paymentId, s.payment.id);
    assert.equal(state.refunds[0].amount, "100.00");
    assert.equal(state.refunds[0].forfeitedDepositAmount, "25.00");
    assert.equal(state.refunds[0].currency, "VND");
    assert.equal(state.refunds[0].status, "PENDING");
    assert.equal(state.refunds[0].reason, "CANCELLED");
    assert.deepEqual(state.events[0].resultSnapshot, result);
    const [payment] = await f.db.select().from(payments).where(eq(payments.id, s.payment.id));
    assert.equal(payment.status, "SUCCEEDED");
    await assert.rejects(
      f.db.insert(bookingRefunds).values({
        bookingId: s.booking.id,
        paymentId: s.payment.id,
        amount: "100.00",
        forfeitedDepositAmount: "25.00",
        currency: "VND",
        reason: "CANCELLED",
      }),
      (error: unknown) => {
        const cause = error as { cause?: { code?: string }; code?: string };
        return (cause.cause?.code ?? cause.code) === "23505";
      },
    );
    assert.deepEqual(await snapshot(f, s), state);
  });

  test("retries replay the exact snapshot; changed action or date rejects reused keys without writes", async () => {
    const s = await seedLifecycle(f);
    const request = mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() });
    const result = await f.repository.mutate(request);
    const state = await snapshot(f, s);
    assert.deepEqual(
      await f.repository.mutate({ ...request, now: new Date(NOW.getTime() + 1000) }),
      result,
    );
    await assert.rejects(
      f.repository.mutate({ ...request, action: "CANCELLED" }),
      lifecycleError("IDEMPOTENCY_KEY_REUSED"),
    );
    await assert.rejects(
      f.repository.mutate({ ...request, checkInAt: "2026-10-11T03:00:00Z" }),
      lifecycleError("IDEMPOTENCY_KEY_REUSED"),
    );
    assert.deepEqual(await snapshot(f, s), state);
    const cancel = mutation(s);
    const cancelled = await f.repository.mutate(cancel);
    const finalState = await snapshot(f, s);
    assert.deepEqual(await f.repository.mutate(cancel), cancelled);
    // A retry of the earlier reschedule must replay that earlier full DTO even
    // though the booking and its refund have since changed.
    assert.deepEqual(await f.repository.mutate(request), result);
    await assert.rejects(f.repository.mutate(mutation(s)), lifecycleError("INVALID_BOOKING_STATE"));
    assert.deepEqual(await snapshot(f, s), finalState);
  });

  test("customer lookup/list/detail enforce ownership and history is returned with the refund", async () => {
    const s = await seedLifecycle(f);
    const other = await seedLifecycle(f);
    assert.equal(await f.repository.customerId(s.user.id), s.customer.id);
    assert.equal(await f.repository.customerId(randomUUID()), null);
    assert.deepEqual(await f.repository.list(s.customer.id), [{ id: s.booking.id }]);
    assert.equal(await f.repository.detail(s.booking.id, other.customer.id), null);
    await assert.rejects(
      f.repository.mutate(mutation(s, { customerId: other.customer.id })),
      lifecycleError("NOT_FOUND"),
    );
    assert.equal((await snapshot(f, s)).events.length, 0);
    const request = mutation(s);
    await f.repository.mutate(request);
    const detail = await f.repository.detail(s.booking.id, s.customer.id);
    assert.ok(detail);
    assert.equal(detail.booking.status, "CANCELLED");
    assert.equal(detail.history.length, 1);
    assert.equal(detail.history[0].actorUserId, s.user.id);
    assert.equal(detail.refund?.amount, "100.00");
    assert.equal(detail.arrived, false);
    assert.equal(detail.activeRental, false);
    // Idempotency is scoped to a booking, not globally to the key.
    await f.repository.mutate(mutation(other, { idempotencyKey: request.idempotencyKey }));
  });

  test("reschedule excludes its own allocation, shifts the entire rental period/slot, and preserves payment", async () => {
    const s = await seedLifecycle(f);
    const result = await f.repository.mutate(
      mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() }),
    );
    const state = await snapshot(f, s);
    assert.equal(state.booking.status, "CONFIRMED");
    assert.equal(state.booking.rescheduleCount, 1);
    assert.deepEqual(state.booking.checkInSlotStart, NEXT);
    assert.deepEqual(state.booking.checkInSlotEnd, new Date(NEXT.getTime() + 3600000));
    assert.deepEqual(state.booking.rentalEndAt, NEXT_END);
    assert.equal(state.allocations.length, 1);
    assert.equal(state.allocations[0].id, s.allocation.id);
    assert.deepEqual(state.allocations[0].startsAt, NEXT);
    assert.deepEqual(state.allocations[0].endsAt, NEXT_END);
    assert.equal(state.allocations[0].status, "ACTIVE");
    assert.equal(state.assignments[0].status, "CANCELLED");
    assert.equal(state.booking.assignedStaffId, null);
    assert.equal(state.refunds.length, 0);
    assert.equal(state.booking.totalAmount, s.booking.totalAmount);
    assert.deepEqual(state.events[0].previousCheckInAt, START);
    assert.deepEqual(state.events[0].newCheckInAt, NEXT);
    assert.deepEqual(state.events[0].resultSnapshot, result);
  });

  test("late-period capacity conflicts roll back every booking side effect; expired holds do not block", async () => {
    const s = await seedLifecycle(f);
    const [hold] = await f.db
      .insert(capacityAllocations)
      .values({
        facilityId: s.facility.id,
        unitTypeId: s.unitType.id,
        referenceId: randomUUID(),
        kind: "HOLD",
        startsAt: new Date("2026-11-09T03:00:00Z"),
        endsAt: new Date("2026-11-12T03:00:00Z"),
        expiresAt: new Date(NOW.getTime() + 1000),
      })
      .returning();
    const before = await snapshot(f, s);
    const request = mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() });
    await assert.rejects(f.repository.mutate(request), lifecycleError("CAPACITY_UNAVAILABLE"));
    assert.deepEqual(await snapshot(f, s), before);
    await f.db
      .update(capacityAllocations)
      .set({ expiresAt: NOW })
      .where(eq(capacityAllocations.id, hold.id));
    await f.repository.mutate(request); // Failed key wasn't consumed; expiry equality is expired.
    assert.equal((await snapshot(f, s)).booking.rescheduleCount, 1);
  });

  for (const action of ["CANCELLED", "RESCHEDULED"] as const) {
    test(`${action} rolls back earlier writes if the final audit insert violates its actor FK`, async () => {
      const s = await seedLifecycle(f);
      const before = await snapshot(f, s);
      await assert.rejects(
        f.repository.mutate(
          mutation(s, {
            action,
            checkInAt: action === "RESCHEDULED" ? NEXT.toISOString() : undefined,
            actorUserId: randomUUID(),
          }),
        ),
        (error: unknown) => {
          const cause = error as { cause?: { code?: string }; code?: string };
          return (cause.cause?.code ?? cause.code) === "23503";
        },
      );
      assert.deepEqual(await snapshot(f, s), before);
    });
  }

  test("two successful reschedules exhaust the limit and the third leaves no changes", async () => {
    const s = await seedLifecycle(f);
    await f.repository.mutate(
      mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() }),
    );
    await f.repository.mutate(
      mutation(s, { action: "RESCHEDULED", checkInAt: "2026-10-12T03:00:00Z" }),
    );
    const before = await snapshot(f, s);
    assert.equal(before.booking.rescheduleCount, 2);
    assert.equal(before.events.length, 2);
    await assert.rejects(
      f.repository.mutate(
        mutation(s, { action: "RESCHEDULED", checkInAt: "2026-10-14T03:00:00Z" }),
      ),
      lifecycleError("RESCHEDULE_LIMIT"),
    );
    assert.deepEqual(await snapshot(f, s), before);
  });

  test("racing cancellation and no-show yield one terminal transition, event and refund", async () => {
    const s = await seedLifecycle(f);
    const now = new Date("2026-10-05T08:00:00Z");
    const results = await f.contend(lockBooking(s), [
      () => f.repository.mutate(mutation(s, { now })),
      () => f.repository.mutate(mutation(s, { now, action: "NO_SHOW" })),
    ]);
    oneWinner(results, "INVALID_BOOKING_STATE");
    const state = await snapshot(f, s);
    assert.ok(["CANCELLED", "NO_SHOW"].includes(state.booking.status));
    assert.equal(state.events.length, 1);
    assert.equal(state.refunds.length, 1);
    assert.equal(state.refunds[0].reason, state.booking.status);
    assert.equal(state.events[0].action, state.booking.status);
    assert.equal(state.allocations[0].status, "RELEASED");
  }, 15_000);

  test("simultaneous identical requests replay one result and create one refund/event", async () => {
    const s = await seedLifecycle(f);
    const request = mutation(s);
    const results = await f.contend(lockBooking(s), [
      () => f.repository.mutate(request),
      () => f.repository.mutate(request),
    ]);
    assert.ok(results.every((r) => r.status === "fulfilled"));
    assert.deepEqual(results[0], results[1]);
    const state = await snapshot(f, s);
    assert.equal(state.refunds.length, 1);
    assert.equal(state.events.length, 1);
  }, 15_000);

  test("two racing reschedules on one booking cannot both consume its last permitted change", async () => {
    const s = await seedLifecycle(f);
    await f.db.update(bookings).set({ rescheduleCount: 1 }).where(eq(bookings.id, s.booking.id));
    const results = await f.contend(lockBooking(s), [
      () =>
        f.repository.mutate(mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() })),
      () =>
        f.repository.mutate(
          mutation(s, { action: "RESCHEDULED", checkInAt: "2026-10-12T03:00:00Z" }),
        ),
    ]);
    oneWinner(results, "RESCHEDULE_LIMIT");
    const state = await snapshot(f, s);
    assert.equal(state.booking.rescheduleCount, 2);
    assert.equal(state.events.length, 1);
    assert.equal(state.refunds.length, 0);
    assert.deepEqual(state.allocations[0].startsAt, state.booking.checkInSlotStart);
    assert.deepEqual(state.allocations[0].endsAt, state.booking.rentalEndAt);
  }, 15_000);

  for (const first of ["VERIFIED", "NO_SHOW"] as const) {
    test(`verification/no-show lock protocol serializes with ${first} winning first`, async () => {
      const s = await seedLifecycle(f);
      const request = mutation(s, { action: "NO_SHOW", now: new Date("2026-10-05T08:00:00Z") });
      let loser: PromiseSettledResult<unknown>[] = [];
      await f.db.transaction(async (tx) => {
        await lockBooking(s)(tx);
        const pending = Promise.allSettled([
          first === "VERIFIED"
            ? f.repository.mutate(request)
            : f.db.transaction((actor) => verifyArrival(actor, s)),
        ]);
        try {
          await f.waitForWaiters(1);
          if (first === "VERIFIED") assert.equal(await verifyArrival(tx, s), true);
          else await transitionBooking(tx, request);
        } finally {
          // Capture after the holder commits, below; do not await a blocked actor here.
          void pending.then((result) => {
            loser = result;
          });
        }
      });
      // Poll completion with a bounded, event-loop-friendly wait after releasing lock.
      const deadline = Date.now() + 5000;
      while (!loser.length && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(loser.length, 1);
      const state = await snapshot(f, s);
      if (first === "VERIFIED") {
        assert.equal(loser[0].status, "rejected");
        assert.ok(
          loser[0].status === "rejected" && lifecycleError("ALREADY_ARRIVED")(loser[0].reason),
        );
        assert.equal(state.booking.status, "CONFIRMED");
        assert.equal(state.verifications[0].status, "VERIFIED");
        assert.equal(state.allocations[0].status, "ACTIVE");
        assert.equal(state.refunds.length, 0);
        assert.equal(state.events.length, 0);
      } else {
        assert.deepEqual(loser[0], { status: "fulfilled", value: false });
        assert.equal(state.booking.status, "NO_SHOW");
        assert.equal(state.verifications.length, 0);
        assert.equal(state.refunds.length, 1);
        assert.equal(state.events.length, 1);
      }
    }, 15_000);
  }

  test("hold/reschedule contention on the last unit never creates two active overlapping reservations", async () => {
    const s = await seedLifecycle(f);
    // Original reservation is outside the contested new period.
    await f.db
      .update(bookings)
      .set({
        checkInSlotStart: new Date("2026-12-05T03:00:00Z"),
        checkInSlotEnd: new Date("2026-12-05T04:00:00Z"),
        rentalEndAt: new Date("2027-01-05T03:00:00Z"),
      })
      .where(eq(bookings.id, s.booking.id));
    await f.db
      .update(capacityAllocations)
      .set({ startsAt: new Date("2026-12-05T03:00:00Z"), endsAt: new Date("2027-01-05T03:00:00Z") })
      .where(eq(capacityAllocations.id, s.allocation.id));
    const results = await f.contend<unknown>(lockInventory(s), [
      () =>
        f.repository.mutate(mutation(s, { action: "RESCHEDULED", checkInAt: NEXT.toISOString() })),
      () => createCompetingHold(f, s),
    ]);
    const state = await snapshot(f, s);
    const rows = await f.db
      .select()
      .from(capacityAllocations)
      .where(eq(capacityAllocations.unitTypeId, s.unitType.id));
    const overlaps = rows.filter(
      (r) => r.status === "ACTIVE" && r.startsAt < NEXT_END && r.endsAt > NEXT,
    );
    assert.equal(overlaps.length, 1);
    if (results[0].status === "fulfilled") {
      assert.deepEqual(results[1], { status: "fulfilled", value: false });
      assert.equal(overlaps[0].kind, "BOOKING");
      assert.equal(state.booking.rescheduleCount, 1);
      assert.equal(state.events.length, 1);
    } else {
      assert.ok(lifecycleError("CAPACITY_UNAVAILABLE")(results[0].reason));
      assert.deepEqual(results[1], { status: "fulfilled", value: true });
      assert.equal(overlaps[0].kind, "HOLD");
      assert.equal(state.booking.rescheduleCount, 0);
      assert.equal(state.events.length, 0);
      assert.equal(state.assignments[0].status, "ACTIVE");
    }
    assert.equal(state.refunds.length, 0);
  }, 15_000);

  test("consumed verification prevents cancellation and no-show without mutating persisted state", async () => {
    const s = await seedLifecycle(f);
    await f.db.insert(checkInVerifications).values({
      bookingId: s.booking.id,
      facilityId: s.facility.id,
      staffId: s.user.id,
      unitAssignmentId: s.assignment.id,
      status: "CONSUMED",
    });
    const before = await snapshot(f, s);
    for (const action of ["CANCELLED", "NO_SHOW"] as const) {
      await assert.rejects(
        f.repository.mutate(mutation(s, { action, now: new Date("2026-10-05T08:00:00Z") })),
        lifecycleError("ALREADY_ARRIVED"),
      );
    }
    assert.deepEqual(await snapshot(f, s), before);
  });

  test("refund claims skip locked rows and concurrent workers receive disjoint leases", async () => {
    // Make worker fixtures deterministic regardless of refund defaults/wall clock.
    await f.db.update(bookingRefunds).set({ nextRetryAt: new Date("2099-01-01T00:00:00Z") });
    const s = await seedLifecycle(f);
    await f.repository.mutate(mutation(s));
    const [refund] = (await snapshot(f, s)).refunds;
    await f.db
      .update(bookingRefunds)
      .set({ nextRetryAt: NOW })
      .where(eq(bookingRefunds.id, refund.id));
    const worker = new BookingRefundsRepository(f.db);
    await f.db.transaction(async (tx) => {
      await tx.select().from(bookingRefunds).where(eq(bookingRefunds.id, refund.id)).for("update");
      assert.deepEqual(await worker.claim(NOW), []); // SKIP LOCKED returns promptly.
    });
    const batches = await Promise.all([worker.claim(NOW), worker.claim(NOW)]);
    const claims = batches.flat();
    assert.equal(claims.length, 1);
    assert.equal(claims[0].id, refund.id);
    assert.equal(claims[0].attempts, 1);
    assert.ok(claims[0].leaseToken);
    assert.deepEqual(claims[0].leaseUntil, new Date(NOW.getTime() + 60000));
    assert.deepEqual(await worker.claim(NOW), []);
  });

  test("expired leases reclaim with a new token; stale completion/failure cannot overwrite the current claim", async () => {
    await f.db.update(bookingRefunds).set({ nextRetryAt: new Date("2099-01-01T00:00:00Z") });
    const s = await seedLifecycle(f);
    await f.repository.mutate(mutation(s));
    const [refund] = (await snapshot(f, s)).refunds;
    await f.db
      .update(bookingRefunds)
      .set({ nextRetryAt: NOW })
      .where(eq(bookingRefunds.id, refund.id));
    const worker = new BookingRefundsRepository(f.db);
    const [first] = await worker.claim(NOW);
    assert.ok(first.leaseToken);
    const reclaimedAt = new Date(NOW.getTime() + 60000);
    const [second] = await worker.claim(reclaimedAt); // Lease expiry is inclusive.
    assert.ok(second.leaseToken);
    assert.notEqual(first.leaseToken, second.leaseToken);
    assert.equal(second.attempts, 2);
    const before = await snapshot(f, s);
    await worker.complete(refund.id, first.leaseToken, "stale-provider-reference", reclaimedAt);
    await worker.fail(refund.id, first.leaseToken, 5, reclaimedAt);
    assert.deepEqual(await snapshot(f, s), before);
    await worker.complete(refund.id, second.leaseToken, "test-provider-reference", reclaimedAt);
    const completed = await snapshot(f, s);
    assert.equal(completed.refunds[0].status, "SUCCEEDED");
    assert.equal(completed.refunds[0].providerReference, "test-provider-reference");
    assert.equal(completed.refunds[0].simulation, true);
    assert.equal(completed.refunds[0].leaseToken, null);
    assert.equal(completed.refunds[0].leaseUntil, null);
    await worker.fail(refund.id, second.leaseToken, 5, reclaimedAt);
    assert.deepEqual(await snapshot(f, s), completed);
    assert.deepEqual(await worker.claim(reclaimedAt), []);
  });

  test("refund failure schedules exponential retries, stops at five attempts and clears leases", async () => {
    await f.db.update(bookingRefunds).set({ nextRetryAt: new Date("2099-01-01T00:00:00Z") });
    const s = await seedLifecycle(f);
    await f.repository.mutate(mutation(s));
    const [refund] = (await snapshot(f, s)).refunds;
    await f.db
      .update(bookingRefunds)
      .set({ nextRetryAt: NOW })
      .where(eq(bookingRefunds.id, refund.id));
    const worker = new BookingRefundsRepository(f.db);
    let now = NOW;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const [claim] = await worker.claim(now);
      assert.equal(claim.attempts, attempt);
      assert.ok(claim.leaseToken);
      await worker.fail(claim.id, claim.leaseToken, claim.attempts, now);
      const state = await snapshot(f, s);
      const retryAt = new Date(now.getTime() + 10000 * 2 ** (attempt - 1));
      assert.deepEqual(state.refunds[0].nextRetryAt, retryAt);
      assert.equal(state.refunds[0].leaseToken, null);
      assert.equal(state.refunds[0].leaseUntil, null);
      assert.equal(state.refunds[0].status, attempt === 5 ? "FAILED" : "PENDING");
      assert.deepEqual(await worker.claim(new Date(retryAt.getTime() - 1)), []);
      now = retryAt;
    }
    assert.deepEqual(await worker.claim(now), []);
  });

  test("a crashed fifth claim is marked failed after lease expiry without a sixth attempt", async () => {
    await f.db.update(bookingRefunds).set({ nextRetryAt: new Date("2099-01-01T00:00:00Z") });
    const s = await seedLifecycle(f);
    await f.repository.mutate(mutation(s));
    const [refund] = (await snapshot(f, s)).refunds;
    await f.db
      .update(bookingRefunds)
      .set({ attempts: 5, nextRetryAt: NOW, leaseToken: randomUUID(), leaseUntil: NOW })
      .where(eq(bookingRefunds.id, refund.id));
    assert.deepEqual(await new BookingRefundsRepository(f.db).claim(NOW), []);
    const state = await snapshot(f, s);
    assert.equal(state.refunds[0].status, "FAILED");
    assert.equal(state.refunds[0].attempts, 5);
    assert.equal(state.refunds[0].leaseToken, null);
    assert.equal(state.refunds[0].leaseUntil, null);
  });
});
