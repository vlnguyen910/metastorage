import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewReservationDraft } from "@metastorage/database";
import type { ReservationsRepository } from "../../../src/modules/reservations/reservations.repository";
import { ReservationsService } from "../../../src/modules/reservations/reservations.service";

const facilityId = "00000000-0000-0000-0000-000000000001";
const unitTypeId = "00000000-0000-0000-0000-000000000002";

function input(overrides: Record<string, unknown> = {}) {
  return {
    facilityId,
    unitTypeId,
    checkInAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    durationMonths: 3,
    contact: {
      fullName: "Nguyen Van A",
      email: "guest@example.com",
      phone: "+84901234567",
    },
    ...overrides,
  } as Parameters<ReservationsService["createDraft"]>[0];
}

function repository(overrides: Partial<ReservationsRepository> = {}) {
  const now = new Date();
  return {
    findActiveContext: async () => ({ facility: {}, unitType: { monthlyPrice: 900000 } }),
    findOperatingHours: async () => ({ openTime: "00:00:00", closeTime: "23:59:59" }),
    countCapacity: async () => 1,
    createDraft: async (draft: NewReservationDraft) => ({
      id: "00000000-0000-0000-0000-000000000003",
      ...draft,
      createdAt: now,
      updatedAt: now,
    }),
    ...overrides,
  } as unknown as ReservationsRepository;
}

describe("reservations service", () => {
  it("checks capacity within the selected facility for a shared unit type", async () => {
    let capacityArgs: unknown[] = [];
    const service = new ReservationsService(
      repository({
        countCapacity: async (...args: unknown[]) => {
          capacityArgs = args;
          return 1;
        },
      }),
    );
    const draft = await service.createDraft(input());

    assert.deepEqual(capacityArgs, [
      facilityId,
      unitTypeId,
      new Date(draft.checkInAt),
      new Date(draft.rentalEndAt),
    ]);
  });

  it("creates a guest-capable draft without a User identity", async () => {
    const service = new ReservationsService(repository());
    const draft = await service.createDraft(input());

    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.pricingStatus, "PRICED");
    assert.deepEqual(draft.pricing, {
      monthlyRateSnapshot: "900000",
      rentalFeeAmount: "2700000",
      depositAmount: "900000",
      totalAmount: "3600000",
      currency: "VND",
    });
    assert.equal(draft.contact.phone, "+84901234567");
    assert.equal(draft.durationMonths, 3);
  });

  it("rejects capacity exhaustion", async () => {
    const service = new ReservationsService(repository({ countCapacity: async () => 0 }));

    await assert.rejects(() => service.createDraft(input()), {
      code: "CAPACITY_UNAVAILABLE",
    });
  });

  it("accepts check-in beyond 30 days with no advance booking limit", async () => {
    const service = new ReservationsService(repository());
    const checkInAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const draft = await service.createDraft(input({ checkInAt }));
    assert.equal(draft.checkInAt, checkInAt);
  });

  it("rejects past check-in with a specific error code", async () => {
    const service = new ReservationsService(repository());
    const checkInAt = new Date(Date.now() - 60_000).toISOString();
    await assert.rejects(() => service.createDraft(input({ checkInAt })), {
      code: "CHECK_IN_IN_PAST",
    });
  });

  it("reports the actual facility operating hours for an invalid check-in time", async () => {
    const service = new ReservationsService(
      repository({
        findOperatingHours: async () =>
          ({ openTime: "08:00:00", closeTime: "18:00:00" }) as Awaited<
            ReturnType<ReservationsRepository["findOperatingHours"]>
          >,
      }),
    );
    const day = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await assert.rejects(() => service.createDraft(input({ checkInAt: `${day}T07:59:00+07:00` })), {
      code: "CHECK_IN_OUTSIDE_HOURS",
      message: "Giờ nhận kho phải từ 08:00 đến 18:00 (giờ Việt Nam) tại chi nhánh này.",
    });
    const draft = await service.createDraft(input({ checkInAt: `${day}T08:00:00+07:00` }));
    assert.equal(draft.status, "DRAFT");
  });

  it("creates a ten-minute hold using the draft access token", async () => {
    const now = new Date();
    const service = new ReservationsService(
      repository({
        createHold: async () => ({
          id: "00000000-0000-0000-0000-000000000004",
          facilityId,
          unitTypeId,
          referenceId: "00000000-0000-0000-0000-000000000003",
          accessTokenHash: "hash",
          kind: "HOLD" as const,
          status: "ACTIVE" as const,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        }),
      }),
    );

    const hold = await service.createHold("00000000-0000-0000-0000-000000000003", "a".repeat(64));
    assert.equal(hold.status, "ACTIVE");
    assert.equal(hold.holdToken, "a".repeat(64));
  });
});
