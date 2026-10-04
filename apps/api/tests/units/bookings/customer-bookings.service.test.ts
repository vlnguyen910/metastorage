import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerBooking } from "@metastorage/contracts";
import { BookingLifecycleError } from "../../../../../packages/database/src/booking-lifecycle.messages";
import type { BookingLifecycleRepository } from "../../../../../packages/database/src/booking-lifecycle.repository";
import type { LifecycleMutation } from "../../../../../packages/database/src/booking-lifecycle.types";
import { AppError } from "../../../src/common/errors/app-error";
import { CustomerBookingsService } from "../../../src/modules/bookings/customer-bookings.service";

// The service imports the database barrel, whose normal client is lazy. Every
// repository method here is a fixture: no database client executes any SQL.
const userId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-01T00:00:00Z");

function bookingDTO(overrides: Partial<CustomerBooking> = {}): CustomerBooking {
  return {
    id: bookingId,
    bookingCode: "BK-TEST-91",
    facility: {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Test facility",
      address: "Test address",
    },
    unitType: { id: "55555555-5555-4555-8555-555555555555", name: "Small", sizeLabel: "2 sqm" },
    checkInAt: "2026-10-05T03:00:00Z",
    checkInSlotEnd: "2026-10-05T04:00:00Z",
    rentalEndAt: "2026-11-05T03:00:00Z",
    durationMonths: 1,
    status: "CONFIRMED",
    rescheduleCount: 0,
    pricing: {
      rentalFeeAmount: "100.00",
      depositAmount: "25.00",
      totalAmount: "125.00",
      currency: "VND",
    },
    history: [],
    refund: null,
    actions: { canCancel: true, canReschedule: true, reasonCodes: [] },
    ...overrides,
  };
}

function fixture(
  options: {
    linked?: boolean;
    snapshot?: CustomerBooking | null;
    result?: CustomerBooking;
    error?: Error;
  } = {},
) {
  const calls = {
    customers: [] as string[],
    lists: [] as string[],
    snapshots: [] as { bookingId: string; customerId: string; now: Date }[],
    mutations: [] as LifecycleMutation[],
  };
  const repository = {
    async customerId(id: string) {
      calls.customers.push(id);
      return options.linked === false ? null : customerId;
    },
    async list(id: string) {
      calls.lists.push(id);
      return [{ id: bookingId }];
    },
    async snapshot(id: string, owner: string, at: Date) {
      calls.snapshots.push({ bookingId: id, customerId: owner, now: at });
      return options.snapshot === undefined ? bookingDTO() : options.snapshot;
    },
    async mutate(input: LifecycleMutation) {
      calls.mutations.push(input);
      if (options.error) throw options.error;
      return options.result ?? bookingDTO();
    },
  };
  return {
    calls,
    service: new CustomerBookingsService(
      repository as unknown as BookingLifecycleRepository,
      () => now,
    ),
  };
}

function notFound(error: unknown) {
  return error instanceof AppError && error.statusCode === 404 && error.code === "NOT_FOUND";
}

describe("CustomerBookingsService ownership and full DTOs", () => {
  it("nonlinked users have an empty list and cannot read or mutate a direct booking ID", async () => {
    const { service, calls } = fixture({ linked: false });
    assert.deepEqual(await service.mine(userId), []);
    await assert.rejects(service.get(userId, bookingId), notFound);
    for (const action of ["CANCELLED", "RESCHEDULED"] as const) {
      await assert.rejects(
        service.mutate(userId, bookingId, action, {
          idempotencyKey: "key",
          checkInAt: "2026-10-10T03:00:00Z",
        }),
        notFound,
      );
    }
    assert.deepEqual(calls.lists, []);
    assert.deepEqual(calls.snapshots, []);
    assert.deepEqual(calls.mutations, []);
  });

  for (const id of [bookingId, "99999999-9999-4999-8999-999999999999"]) {
    it(`returns 404 for an unowned or missing direct ID (${id}) using the linked customer scope`, async () => {
      const { service, calls } = fixture({ snapshot: null });
      await assert.rejects(service.get(userId, id), notFound);
      assert.deepEqual(calls.snapshots, [{ bookingId: id, customerId, now }]);
      assert.deepEqual(calls.mutations, []);
    });
  }

  it("returns the owned full DTO and lists through customer-scoped snapshots", async () => {
    const dto = bookingDTO();
    const { service, calls } = fixture({ snapshot: dto });
    assert.deepEqual(await service.get(userId, bookingId), dto);
    assert.deepEqual(await service.mine(userId), [dto]);
    assert.deepEqual(calls.lists, [customerId]);
    assert.deepEqual(calls.snapshots, [
      { bookingId, customerId, now },
      { bookingId, customerId, now },
    ]);
  });

  for (const action of ["CANCELLED", "RESCHEDULED"] as const) {
    it(`${action} passes owner/actor/time to mutate and returns its full persisted DTO without re-reading`, async () => {
      const dto = bookingDTO({
        status: action === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
        rescheduleCount: action === "RESCHEDULED" ? 1 : 0,
        history: [
          {
            action,
            at: now.toISOString(),
            previousCheckInAt: "2026-10-05T03:00:00Z",
            newCheckInAt: action === "RESCHEDULED" ? "2026-10-10T03:00:00Z" : null,
          },
        ],
        refund:
          action === "CANCELLED"
            ? {
                status: "PENDING",
                amount: "100.00",
                forfeitedDepositAmount: "25.00",
                currency: "VND",
                simulation: false,
              }
            : null,
      });
      const { service, calls } = fixture({ result: dto });
      const input = {
        idempotencyKey: "retry-key",
        ...(action === "RESCHEDULED" ? { checkInAt: "2026-10-10T03:00:00Z" } : {}),
      };
      assert.deepEqual(await service.mutate(userId, bookingId, action, input), dto);
      assert.deepEqual(calls.mutations, [
        { bookingId, customerId, actorUserId: userId, action, ...input, now },
      ]);
      assert.deepEqual(calls.snapshots, []);
    });
  }

  it("translates wrong-owner mutation NOT_FOUND to 404 without losing its domain code", async () => {
    const { service, calls } = fixture({ error: new BookingLifecycleError("NOT_FOUND", 404) });
    await assert.rejects(
      service.mutate(userId, bookingId, "CANCELLED", { idempotencyKey: "wrong-owner" }),
      notFound,
    );
    assert.equal(calls.mutations[0].customerId, customerId);
    assert.deepEqual(calls.snapshots, []);
  });

  it("retains lifecycle conflict codes and does not disguise unexpected repository failures", async () => {
    const conflict = fixture({ error: new BookingLifecycleError("IDEMPOTENCY_KEY_REUSED") });
    await assert.rejects(
      conflict.service.mutate(userId, bookingId, "CANCELLED", { idempotencyKey: "reused" }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === "IDEMPOTENCY_KEY_REUSED",
    );
    const unexpected = new Error("fixture connection failure");
    const broken = fixture({ error: unexpected });
    await assert.rejects(
      broken.service.mutate(userId, bookingId, "CANCELLED", { idempotencyKey: "key" }),
      (error: unknown) => error === unexpected,
    );
  });
});
