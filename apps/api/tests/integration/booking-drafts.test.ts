import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import {
  bookings,
  capacityAllocations,
  checkInSlots,
  count,
  db,
  eq,
  facilities,
  facilityOperatingHours,
  facilityUnitTypes,
  payments,
  reservationDrafts,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { bookingsRoutes } from "../../src/modules/bookings/bookings.routes";

// Requires a migrated isolated DB, with DATABASE_URL and BOOKING_TEST_DATABASE_URL set to the same URL.
const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
const ids = {
  facility: randomUUID(),
  type: randomUUID(),
  unit: randomUUID(),
  slot: randomUUID(),
  extraSlot: randomUUID(),
};
const input = {
  facilityId: ids.facility,
  unitTypeId: ids.type,
  checkInAt: "2030-01-01T09:30:00+07:00",
  durationMonths: 2,
};
const app = Fastify();
let fixturesCreated = false;
const createDraft = (payload: Record<string, unknown> = input) =>
  app.inject({ method: "POST", url: "/api/bookings/drafts", payload });

describe.skipIf(!testUrl)("POST /api/bookings/drafts with PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl)
      throw new Error("DATABASE_URL must match the isolated BOOKING_TEST_DATABASE_URL");
    await db.transaction(async (tx) => {
      await tx
        .insert(facilities)
        .values({ id: ids.facility, code: ids.facility, name: "Draft test", address: "Test" });
      await tx.insert(unitTypes).values({
        id: ids.type,
        code: ids.type,
        name: "Draft test",
        sizeLabel: "S",
        lengthM: 1,
        widthM: 1,
        heightM: 1,
        monthlyPrice: 1000000,
      });
      await tx.insert(facilityUnitTypes).values({ facilityId: ids.facility, unitTypeId: ids.type });
      await tx
        .insert(storageUnits)
        .values({ id: ids.unit, code: ids.unit, facilityId: ids.facility, unitTypeId: ids.type });
      await tx
        .insert(checkInSlots)
        .values({ id: ids.slot, name: "Draft test", startTime: "09:00", endTime: "10:00" });
    });
    fixturesCreated = true;
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(bookingsRoutes, { prefix: "/api" });
    await app.ready();
  });

  beforeEach(async () => {
    await db.update(facilities).set({ isActive: true }).where(eq(facilities.id, ids.facility));
    await db
      .update(unitTypes)
      .set({ isActive: true, monthlyPrice: 1000000 })
      .where(eq(unitTypes.id, ids.type));
    await db
      .update(facilityUnitTypes)
      .set({ isActive: true })
      .where(eq(facilityUnitTypes.facilityId, ids.facility));
    await db.update(storageUnits).set({ status: "AVAILABLE" }).where(eq(storageUnits.id, ids.unit));
    await db.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
    await db
      .delete(facilityOperatingHours)
      .where(eq(facilityOperatingHours.facilityId, ids.facility));
    await db.delete(checkInSlots).where(eq(checkInSlots.id, ids.extraSlot));
  });

  afterAll(async () => {
    await app.close();
    if (!fixturesCreated) return;
    await db.transaction(async (tx) => {
      await tx.delete(bookings).where(eq(bookings.facilityId, ids.facility));
      await tx.delete(capacityAllocations).where(eq(capacityAllocations.facilityId, ids.facility));
      await tx.delete(storageUnits).where(eq(storageUnits.id, ids.unit));
      await tx.delete(facilityUnitTypes).where(eq(facilityUnitTypes.facilityId, ids.facility));
      await tx.delete(facilities).where(eq(facilities.id, ids.facility));
      await tx.delete(unitTypes).where(eq(unitTypes.id, ids.type));
      await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.slot));
      await tx.delete(checkInSlots).where(eq(checkInSlots.id, ids.extraSlot));
    });
  });

  test("creates a guest draft with normalized schedule, immutable pricing and only a token hash persisted", async () => {
    const beforePayments = await db.select({ count: count() }).from(payments);
    const beforeReservations = await db.select({ count: count() }).from(reservationDrafts);
    const response = await createDraft({
      ...input,
      contact: { fullName: "Ignored", email: "ignored@example.test", phone: "0900000000" },
      totalAmount: "1",
      status: "CONFIRMED",
    });
    expect(response.statusCode).toBe(201);
    const { data } = response.json();
    expect(data).toMatchObject({
      facilityId: ids.facility,
      unitTypeId: ids.type,
      status: "DRAFT",
      checkInAt: "2030-01-01T02:00:00.000Z",
      rentalEndAt: "2030-03-01T02:00:00.000Z",
      durationMonths: 2,
      pricing: {
        monthlyRateSnapshot: "1000000",
        rentalFeeAmount: "2000000",
        depositAmount: "1000000",
        totalAmount: "3000000",
        currency: "VND",
      },
    });
    expect(data.draftAccessToken).toMatch(/^[a-f0-9]{64}$/);
    expect(data.accessTokenHash).toBeUndefined();
    expect(data.contact).toBeUndefined();
    const [row] = await db.select().from(bookings).where(eq(bookings.id, data.id));
    expect(row).toMatchObject({
      status: "DRAFT",
      userId: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      bookingCode: null,
      assignedStaffId: null,
      qrTokenHash: null,
      checkInDate: "2030-01-01",
      checkInSlotId: ids.slot,
      accessTokenHash: createHash("sha256").update(data.draftAccessToken).digest("hex"),
    });
    await db.update(unitTypes).set({ monthlyPrice: 2000000 }).where(eq(unitTypes.id, ids.type));
    expect((await db.select().from(bookings).where(eq(bookings.id, data.id)))[0]?.totalAmount).toBe(
      "3000000.00",
    );
    expect(await db.select({ count: count() }).from(payments)).toEqual(beforePayments);
    expect(await db.select({ count: count() }).from(reservationDrafts)).toEqual(beforeReservations);
    expect(
      await db
        .select()
        .from(capacityAllocations)
        .where(eq(capacityAllocations.facilityId, ids.facility)),
    ).toHaveLength(0);
  });

  test.each([0, 13, 1.5])("rejects invalid duration %s", async (durationMonths) => {
    expect((await createDraft({ ...input, durationMonths })).statusCode).toBe(400);
  });
  test("rejects invalid IDs and dates", async () => {
    expect((await createDraft({ ...input, facilityId: "invalid" })).statusCode).toBe(400);
    expect((await createDraft({ ...input, checkInAt: "invalid" })).statusCode).toBe(400);
  });
  test("rejects a past check-in", async () => {
    const response = await createDraft({ ...input, checkInAt: "2000-01-01T09:30:00+07:00" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CHECK_IN_IN_PAST");
  });
  test("rejects unavailable facility, unit type or offering", async () => {
    await db.update(facilities).set({ isActive: false }).where(eq(facilities.id, ids.facility));
    expect((await createDraft()).statusCode).toBe(404);
    await db.update(facilities).set({ isActive: true }).where(eq(facilities.id, ids.facility));
    await db.update(unitTypes).set({ isActive: false }).where(eq(unitTypes.id, ids.type));
    expect((await createDraft()).statusCode).toBe(404);
    await db.update(unitTypes).set({ isActive: true }).where(eq(unitTypes.id, ids.type));
    await db
      .update(facilityUnitTypes)
      .set({ isActive: false })
      .where(eq(facilityUnitTypes.facilityId, ids.facility));
    expect((await createDraft()).statusCode).toBe(404);
    expect((await createDraft({ ...input, unitTypeId: randomUUID() })).statusCode).toBe(404);
  });
  test("rejects times outside operating hours or slot definitions", async () => {
    const hours = await createDraft({ ...input, checkInAt: "2030-01-01T05:30:00+07:00" });
    expect(hours.statusCode).toBe(400);
    expect(hours.json().error.code).toBe("CHECK_IN_OUTSIDE_HOURS");
    const slot = await createDraft({ ...input, checkInAt: "2030-01-01T10:00:00+07:00" });
    expect(slot.statusCode).toBe(400);
    expect(slot.json().error.code).toBe("CHECK_IN_OUTSIDE_SLOTS");
  });
  test("rechecks operating hours after normalization to the slot start", async () => {
    await db
      .insert(facilityOperatingHours)
      .values({ facilityId: ids.facility, dayOfWeek: 2, openTime: "09:15", closeTime: "22:00" });
    const response = await createDraft();
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CHECK_IN_OUTSIDE_HOURS");
  });
  test("rejects ambiguous slot definitions", async () => {
    await db
      .insert(checkInSlots)
      .values({ id: ids.extraSlot, name: "Overlap", startTime: "09:15", endTime: "09:45" });
    const response = await createDraft();
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CHECK_IN_OUTSIDE_SLOTS");
  });
  test("rejects exhausted capacity and ignores expired holds", async () => {
    const [allocation] = await db
      .insert(capacityAllocations)
      .values({
        facilityId: ids.facility,
        unitTypeId: ids.type,
        referenceId: randomUUID(),
        kind: "HOLD",
        status: "ACTIVE",
        startsAt: new Date("2030-01-01T02:00:00Z"),
        endsAt: new Date("2030-03-01T02:00:00Z"),
        expiresAt: new Date(Date.now() + 600000),
      })
      .returning();
    if (!allocation) throw new Error("Allocation fixture was not created");
    const response = await createDraft();
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CAPACITY_UNAVAILABLE");
    await db
      .update(capacityAllocations)
      .set({ expiresAt: new Date(0) })
      .where(eq(capacityAllocations.id, allocation.id));
    expect((await createDraft()).statusCode).toBe(201);
  });
  test.each(["INACTIVE", "LOCKED", "MAINTENANCE"] as const)(
    "rejects inventory with only %s units",
    async (status) => {
      await db.update(storageUnits).set({ status }).where(eq(storageUnits.id, ids.unit));
      expect((await createDraft()).statusCode).toBe(409);
    },
  );
  test("draft creation does not consume capacity for another draft", async () => {
    const first = await createDraft();
    const second = await createDraft();
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().data.id).not.toBe(second.json().data.id);
    expect(first.json().data.draftAccessToken).not.toBe(second.json().data.draftAccessToken);
  });
});
