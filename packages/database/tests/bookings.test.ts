import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { BookingsRepository } from "../../../apps/api/src/modules/bookings/bookings.repository";
import { getDatabaseUrl } from "../src/env";
import * as schema from "../src/schema";

describe("Booking module with customer contact and check-in slots", () => {
  const databaseName = `booking_test_${randomUUID().replaceAll("-", "")}`;
  const facilityId = randomUUID();
  const unitTypeId = randomUUID();
  const customerId = randomUUID();
  const slotId = randomUUID();
  const bookingId = randomUUID();
  const draftId = randomUUID();
  const reservationId = randomUUID();
  const staffId = randomUUID();
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let repository: BookingsRepository;
  let created = false;

  before(async () => {
    const url = new URL(getDatabaseUrl());
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "Database integration tests require a loopback PostgreSQL server",
    );
    url.pathname = "/postgres";
    admin = postgres(url.toString(), { max: 1 });
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    url.pathname = `/${databaseName}`;
    client = postgres(url.toString(), { max: 1 });
    const db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    repository = new BookingsRepository(db);

    await db.insert(schema.users).values({
      id: staffId,
      name: "Test staff",
      email: "staff@example.com",
      role: "FACILITY_STAFF",
      status: "ACTIVE",
    });

    await db.insert(schema.facilities).values({
      id: facilityId,
      code: "TEST",
      name: "Test facility",
      address: "Hanoi",
    });
    await db.insert(schema.unitTypes).values({
      id: unitTypeId,
      code: "TEST-TYPE",
      name: "Test type",
      sizeLabel: "Small",
      lengthM: 2,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 1000000,
    });
    await db.insert(schema.facilityUnitTypes).values({ facilityId, unitTypeId });
    await db.insert(schema.customers).values({
      id: customerId,
      fullName: "Current customer",
      email: "current@example.com",
      phone: "0900000001",
    });
    await db.insert(schema.checkInSlots).values({
      id: slotId,
      name: "Ca 1",
      startTime: "09:00:00",
      endTime: "10:30:00",
    });

    // Allow the regression to run before and after the generated booking migration.
    const columns = await client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bookings'
    `;
    const columnNames = new Set(columns.map((column) => column.column_name));
    const legacyContact = columnNames.has("contact_name")
      ? {
          contact_name: "Old booking contact",
          contact_email: "old@example.com",
          contact_phone: "0999999999",
          currency: "VND",
          paid_at: "2026-10-01T01:00:00Z",
        }
      : {};
    await client`INSERT INTO bookings ${client({
      id: bookingId,
      customer_id: customerId,
      facility_id: facilityId,
      unit_type_id: unitTypeId,
      booking_code: "TEST-BOOKING",
      requested_months: 1,
      check_in_date: "2026-10-08",
      check_in_slot_id: slotId,
      rental_end_at: "2026-11-08T02:00:00Z",
      monthly_rate_snapshot: "1000000",
      rental_fee_amount: "1000000",
      deposit_amount: "1000000",
      total_amount: "2000000",
      status: "CONFIRMED",
      assigned_staff_id: staffId,
      qr_token_hash: null,
      ...legacyContact,
    })}`;
    await db.insert(schema.reservationDrafts).values({
      id: reservationId,
      facilityId,
      unitTypeId,
      checkInAt: new Date("2026-10-08T02:00:00Z"),
      rentalEndAt: new Date("2026-11-08T02:00:00Z"),
      durationMonths: 1,
      contactName: "Checkout customer",
      contactEmail: "current@example.com",
      contactPhone: "0900000001",
    });
    // Payment migration is deliberately deferred to the next module.
    for (const [status, paidAt] of [
      ["FAILED", "2026-09-30T01:00:00Z"],
      ["REFUNDED", "2026-10-01T02:00:00Z"],
      ["PENDING", null],
    ] as const) {
      const id = randomUUID();
      await client`INSERT INTO payments ${client({
        id,
        booking_id: bookingId,
        draft_id: reservationId,
        customer_id: customerId,
        hold_token_hash: "test-hash",
        provider: "mock",
        payment_code: id.slice(0, 8),
        provider_payment_id: id,
        idempotency_key: id,
        total_amount: "2000000",
        currency: "VND",
        status,
        paid_at: paidAt,
      })}`;
    }
  });

  after(async () => {
    if (client) await client.end();
    if (admin) {
      if (created) await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      await admin.end();
    }
  });

  it("reads current customer contact and composes the Vietnam check-in slot", async () => {
    const booking = await repository.findBookingById(bookingId);
    assert.ok(booking);
    assert.equal(booking.contactName, "Current customer");
    assert.equal(booking.contactEmail, "current@example.com");
    assert.equal(booking.checkInSlotStart, "2026-10-08T02:00:00.000Z");
    assert.equal(booking.checkInSlotEnd, "2026-10-08T03:30:00.000Z");
    await client`UPDATE customers SET phone = '0900000002' WHERE id = ${customerId}`;
    assert.equal((await repository.findBookingById(bookingId))?.contactPhone, "0900000002");
  });

  it("retains the original payment time after refund without duplicating list rows", async () => {
    const bookings = await repository.findFacilityBookings(facilityId);
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0]?.paidAt, "2026-10-01T02:00:00.000Z");
  });

  it("supports a customerless draft but excludes it from operations and QR lookup", async () => {
    await client`INSERT INTO bookings ${client({
      id: draftId,
      facility_id: facilityId,
      unit_type_id: unitTypeId,
      requested_months: 1,
      check_in_date: "2026-10-08",
      check_in_slot_id: slotId,
      rental_end_at: "2026-11-08T02:00:00Z",
      monthly_rate_snapshot: "1000000",
      rental_fee_amount: "1000000",
      deposit_amount: "1000000",
      total_amount: "2000000",
      booking_code: "DRAFT-WITH-QR",
      qr_token_hash: createHash("sha256").update("draft-qr").digest("hex"),
      assigned_staff_id: staffId,
    })}`;
    assert.equal(
      (await client`SELECT status FROM bookings WHERE id = ${draftId}`)[0]?.status,
      "DRAFT",
    );
    assert.equal(await repository.findBookingById(draftId), null);
    assert.equal((await repository.findFacilityBookings(facilityId)).length, 1);
    const tasks = await repository.findStaffTasks(staffId);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, bookingId);
    assert.equal(await repository.findByQrToken("draft-qr"), null);
    assert.deepEqual(await repository.assignPhysicalUnit(draftId, randomUUID(), randomUUID()), {
      error: "INVALID_BOOKING_STATUS",
      currentStatus: "DRAFT",
    });
    assert.deepEqual(await repository.assignStaff(draftId, randomUUID()), {
      error: "INVALID_BOOKING_STATUS",
      currentStatus: "DRAFT",
    });
    await assert.rejects(
      () => client`UPDATE bookings SET status = 'CONFIRMED' WHERE id = ${draftId}`,
      (error: unknown) => error instanceof postgres.PostgresError && error.code === "23514",
    );
  });

  it("uses slot timestamps to assign a unit and detect overlapping bookings", async () => {
    const physicalUnitId = randomUUID();
    await client`INSERT INTO storage_units ${client({
      id: physicalUnitId,
      facility_id: facilityId,
      unit_type_id: unitTypeId,
      code: "TEST-UNIT",
      status: "AVAILABLE",
    })}`;
    const result = await repository.assignPhysicalUnit(bookingId, physicalUnitId, staffId);
    assert.ok("assignment" in result);
    assert.equal(result.assignment.physicalUnitId, physicalUnitId);
    const conflicting = await repository.findEligibleUnits(
      facilityId,
      unitTypeId,
      randomUUID(),
      new Date("2026-10-08T02:00:00Z"),
      new Date("2026-11-08T02:00:00Z"),
    );
    assert.equal(conflicting[0]?.isAvailableForPeriod, false);
    const adjacent = await repository.findEligibleUnits(
      facilityId,
      unitTypeId,
      randomUUID(),
      new Date("2026-11-08T02:00:00Z"),
      new Date("2026-12-08T02:00:00Z"),
    );
    assert.equal(adjacent[0]?.isAvailableForPeriod, true);
  });
});
