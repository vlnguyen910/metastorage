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
    findActiveContext: async () => ({ facility: {}, unitType: {} }),
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
  it("creates a guest-capable draft without a User identity", async () => {
    const service = new ReservationsService(repository());
    const draft = await service.createDraft(input());

    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.pricingStatus, "PRICING_NOT_CONFIGURED");
    assert.equal(draft.pricing, null);
    assert.equal(draft.contact.phone, "+84901234567");
    assert.equal(draft.durationMonths, 3);
  });

  it("rejects capacity exhaustion", async () => {
    const service = new ReservationsService(repository({ countCapacity: async () => 0 }));

    await assert.rejects(() => service.createDraft(input()), {
      code: "CAPACITY_UNAVAILABLE",
    });
  });

  it("rejects check-in beyond the 30-day advance window", async () => {
    const service = new ReservationsService(repository());
    const checkInAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

    await assert.rejects(() => service.createDraft(input({ checkInAt })), {
      name: "BadRequestError",
    });
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
