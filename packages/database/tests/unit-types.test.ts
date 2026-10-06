import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { CatalogRepository } from "../../../apps/api/src/modules/catalog/catalog.repository";
import { CheckInsRepository } from "../../../apps/api/src/modules/check-ins/check-ins.repository";
import { ReservationsRepository } from "../../../apps/api/src/modules/reservations/reservations.repository";
import { FacilityUnitTypesRepository } from "../../../apps/api/src/modules/unit-types/facility-unit-types.repository";
import { UnitTypesRepository } from "../../../apps/api/src/modules/unit-types/unit-types.repository";
import type { Database } from "../src/client";
import * as schema from "../src/schema";

// Opt-in: create and remove a separate database on a local PostgreSQL instance.
const adminUrl = process.env.UNIT_TYPES_TEST_ADMIN_URL;

function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? postgresErrorCode(error.cause) : undefined;
}

describe("shared unit types and facility inventory", { skip: !adminUrl }, () => {
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let db: Database;
  let created = false;
  const databaseName = `storex_unit_types_test_${randomUUID().replaceAll("-", "")}`;

  before(async () => {
    assert.ok(adminUrl);
    const url = new URL(adminUrl);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    admin = postgres(adminUrl, { max: 1, connect_timeout: 3 });
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    url.pathname = `/${databaseName}`;
    client = postgres(url.toString(), { max: 5, connect_timeout: 3 });
    db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  });

  after(async () => {
    if (client) await client.end();
    if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`);
    if (admin) await admin.end();
  });

  async function fixture() {
    const code = randomUUID();
    const [facilityA, facilityB, facilityC] = await db
      .insert(schema.facilities)
      .values(
        ["A", "B", "C"].map((suffix) => ({
          code: `${code}-${suffix}`,
          name: `Facility ${suffix}`,
          address: "Test address",
        })),
      )
      .returning();
    assert.ok(facilityA && facilityB && facilityC);
    const unitType = await new UnitTypesRepository(db).create({
      code,
      name: "Shared small unit",
      sizeLabel: "2 m²",
      sizeSqm: 2,
      monthlyPrice: 900000,
    });
    const links = new FacilityUnitTypesRepository(db);
    await links.link(facilityA.id, unitType.id);
    await links.link(facilityB.id, unitType.id);
    return { facilityA, facilityB, facilityC, unitType, links };
  }

  async function inventory(facilityId: string, unitTypeId: string, quantity: number) {
    return db
      .insert(schema.storageUnits)
      .values(
        Array.from({ length: quantity }, () => ({
          facilityId,
          unitTypeId,
          code: randomUUID(),
        })),
      )
      .returning();
  }

  async function draft(facilityId: string, unitTypeId: string) {
    const [result] = await db
      .insert(schema.reservationDrafts)
      .values({
        facilityId,
        unitTypeId,
        checkInAt: new Date("2030-01-01T03:00:00Z"),
        rentalEndAt: new Date("2030-02-01T03:00:00Z"),
        durationMonths: 1,
        contactName: "Test customer",
        contactEmail: "guest@example.com",
        contactPhone: "0900000000",
        accessTokenHash: "test-token-hash",
      })
      .returning();
    assert.ok(result);
    return result;
  }

  it("shares one definition and price across facilities with global code uniqueness", async () => {
    const { facilityA, facilityB, unitType, links } = await fixture();
    const repository = new UnitTypesRepository(db);
    await repository.update(unitType.id, { monthlyPrice: 1200000 });
    const offeringA = (await links.list(facilityA.id, 10, 0))[0];
    const offeringB = (await links.list(facilityB.id, 10, 0))[0];
    assert.equal(offeringA?.unitType.id, unitType.id);
    assert.equal(offeringB?.unitType.id, unitType.id);
    assert.equal(offeringA?.unitType.monthlyPrice, 1200000);
    assert.equal(offeringB?.unitType.monthlyPrice, 1200000);
    assert.equal((await repository.findByCode(unitType.code))?.id, unitType.id);
    await assert.rejects(
      async () => repository.create({ ...unitType, id: randomUUID() }),
      (error) => postgresErrorCode(error) === "23505",
    );
    await assert.rejects(
      async () => links.link(facilityA.id, unitType.id),
      (error) => postgresErrorCode(error) === "23505",
    );
  });

  it("rejects unlinked facility/type pairs in inventory, drafts, holds and bookings", async () => {
    const { facilityC, unitType } = await fixture();
    const [customer] = await db
      .insert(schema.customers)
      .values({ fullName: "Guest", email: `${randomUUID()}@example.com`, phone: "0900000000" })
      .returning();
    assert.ok(customer);
    const rejectsForeignKey = (error: unknown) => postgresErrorCode(error) === "23503";
    await assert.rejects(() => inventory(facilityC.id, unitType.id, 1), rejectsForeignKey);
    await assert.rejects(() => draft(facilityC.id, unitType.id), rejectsForeignKey);
    await assert.rejects(
      async () =>
        db.insert(schema.capacityAllocations).values({
          facilityId: facilityC.id,
          unitTypeId: unitType.id,
          referenceId: randomUUID(),
          kind: "HOLD",
          startsAt: new Date("2030-01-01"),
          endsAt: new Date("2030-02-01"),
        }),
      rejectsForeignKey,
    );
    await assert.rejects(
      async () =>
        db.insert(schema.bookings).values({
          customerId: customer.id,
          facilityId: facilityC.id,
          unitTypeId: unitType.id,
          requestedMonths: 1,
          contactName: "Guest",
          contactEmail: customer.email,
          contactPhone: customer.phone,
          checkInSlotStart: new Date("2030-01-01"),
          rentalEndAt: new Date("2030-02-01"),
          monthlyRateSnapshot: "900000",
          rentalFeeAmount: "900000",
          depositAmount: "900000",
          totalAmount: "1800000",
        }),
      rejectsForeignKey,
    );
    assert.equal(
      await new ReservationsRepository(db).findActiveContext(facilityC.id, unitType.id),
      undefined,
    );
  });

  it("isolates capacity and holds for facilities sharing a type", async () => {
    const { facilityA, facilityB, unitType } = await fixture();
    await inventory(facilityA.id, unitType.id, 1);
    await inventory(facilityB.id, unitType.id, 3);
    const draftA = await draft(facilityA.id, unitType.id);
    const draftB = await draft(facilityB.id, unitType.id);
    const repository = new ReservationsRepository(db);
    const holdA = await repository.createHold(draftA.id, "test-token-hash");
    assert.ok(holdA);
    assert.equal(holdA.facilityId, facilityA.id);
    assert.equal(
      await repository.countCapacity(
        facilityA.id,
        unitType.id,
        draftA.checkInAt,
        draftA.rentalEndAt,
      ),
      0,
    );
    assert.equal(
      await repository.countCapacity(
        facilityB.id,
        unitType.id,
        draftB.checkInAt,
        draftB.rentalEndAt,
      ),
      3,
    );
    assert.equal((await repository.createHold(draftA.id, "test-token-hash"))?.id, holdA.id);
    const secondDraftA = await draft(facilityA.id, unitType.id);
    assert.equal(await repository.createHold(secondDraftA.id, "test-token-hash"), undefined);
    const holdB = await repository.createHold(draftB.id, "test-token-hash");
    assert.ok(holdB);
    assert.equal(holdB.facilityId, facilityB.id);
    assert.equal(
      await repository.countCapacity(
        facilityB.id,
        unitType.id,
        draftB.checkInAt,
        draftB.rentalEndAt,
      ),
      2,
    );
  });

  it("scopes catalog counts and disables only the selected facility offering", async () => {
    const { facilityA, facilityB, unitType, links } = await fixture();
    await inventory(facilityA.id, unitType.id, 1);
    await inventory(facilityB.id, unitType.id, 3);
    const catalog = new CatalogRepository(db);
    assert.equal((await catalog.findRows(facilityA.id)).length, 1);
    assert.equal((await catalog.findRows(facilityB.id)).length, 3);
    await links.setActive(facilityA.id, unitType.id, false);
    assert.equal((await catalog.findRows(facilityA.id)).length, 0);
    assert.equal((await catalog.findRows(facilityB.id)).length, 3);
    const reservations = new ReservationsRepository(db);
    assert.equal(await reservations.findActiveContext(facilityA.id, unitType.id), undefined);
    assert.equal(
      (await reservations.findActiveContext(facilityB.id, unitType.id))?.unitType.id,
      unitType.id,
    );
    const listed = await catalog.listFacilities({ page: 1, pageSize: 100, sort: "name" });
    assert.equal(
      listed.some((row) => row.facility.id === facilityA.id),
      false,
    );
    assert.equal(listed.find((row) => row.facility.id === facilityB.id)?.availableUnits, 3);
  });

  it("keeps historical booking prices and supports check-in after global price changes", async () => {
    const { facilityA, unitType } = await fixture();
    const [customer] = await db
      .insert(schema.customers)
      .values({ fullName: "Guest", email: `${randomUUID()}@example.com`, phone: "0900000000" })
      .returning();
    assert.ok(customer);
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        customerId: customer.id,
        facilityId: facilityA.id,
        unitTypeId: unitType.id,
        requestedMonths: 1,
        contactName: "Guest",
        contactEmail: customer.email,
        contactPhone: customer.phone,
        checkInSlotStart: new Date("2030-01-01"),
        rentalEndAt: new Date("2030-02-01"),
        monthlyRateSnapshot: "900000",
        rentalFeeAmount: "900000",
        depositAmount: "900000",
        totalAmount: "1800000",
      })
      .returning();
    assert.ok(booking);
    await new UnitTypesRepository(db).update(unitType.id, { monthlyPrice: 1200000 });
    const record = await new CheckInsRepository(db).findByBookingId(booking.id);
    assert.equal(record?.unitType.id, unitType.id);
    assert.equal(record?.unitType.monthlyPrice, 1200000);
    assert.equal(record?.booking.monthlyRateSnapshot, "900000.00");
    assert.equal(record?.booking.totalAmount, "1800000.00");
  });
});
