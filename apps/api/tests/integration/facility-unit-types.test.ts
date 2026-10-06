import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ApiUnitTypeSchema } from "@metastorage/contracts";
import { type Database, eq, facilities } from "@metastorage/database";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { createTestDatabase } from "../../../../packages/database/tests/helpers/test-database";
import { setupErrorHandler } from "../../src/common/errors/error-handler";
import { facilitiesRoutes } from "../../src/modules/facilities/facilities.routes";
import { FacilityUnitTypesRepository } from "../../src/modules/unit-types/facility-unit-types.repository";
import { UnitTypesRepository } from "../../src/modules/unit-types/unit-types.repository";

const adminUrl = process.env.UNIT_TYPES_TEST_ADMIN_URL;

describe("GET /api/facilities/:facilityId/unit-types", { skip: !adminUrl }, () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Database;
  before(async () => {
    assert.ok(adminUrl);
    database = await createTestDatabase(adminUrl);
    db = database.db;
  });
  after(async () => {
    if (database) await database.close();
  });
  async function fixture() {
    const [facilityA, facilityB, facilityC] = await db
      .insert(facilities)
      .values(
        ["A", "B", "C"].map((name) => ({ code: randomUUID(), name, address: "Test address" })),
      )
      .returning();
    assert.ok(facilityA && facilityB && facilityC);
    const unitType = await new UnitTypesRepository(db).create({
      code: randomUUID(),
      name: "Shared",
      sizeLabel: "2 m²",
      sizeSqm: 2,
      monthlyPrice: 900000,
    });
    const links = new FacilityUnitTypesRepository(db);
    await links.link(facilityA.id, unitType.id);
    await links.link(facilityB.id, unitType.id);
    return { facilityA, facilityB, facilityC, unitType, links };
  }
  it("serves public facility unit types with active filters, DTOs and pagination", async () => {
    const { facilityA, facilityB, facilityC, unitType, links } = await fixture();
    const repository = new UnitTypesRepository(db);
    const extra = await repository.create({
      code: randomUUID(),
      name: "Extra",
      sizeLabel: "4 m²",
      sizeSqm: 4,
      monthlyPrice: 1500000,
    });
    const inactiveType = await repository.create({
      code: randomUUID(),
      name: "Inactive",
      sizeLabel: "6 m²",
      sizeSqm: 6,
      monthlyPrice: 2100000,
      isActive: false,
    });
    const inactiveOffering = await repository.create({
      code: randomUUID(),
      name: "Hidden offering",
      sizeLabel: "8 m²",
      sizeSqm: 8,
      monthlyPrice: 2700000,
    });
    await links.link(facilityA.id, extra.id);
    await links.link(facilityA.id, inactiveType.id);
    await links.link(facilityA.id, inactiveOffering.id);
    await links.setActive(facilityA.id, inactiveOffering.id, false);

    const app = Fastify();
    app.decorate("db", db);
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    await app.register(facilitiesRoutes, { prefix: "/api/facilities" });
    try {
      const response = await app.inject(`/api/facilities/${facilityA.id}/unit-types`);
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.success, true);
      const types = ApiUnitTypeSchema.array().parse(body.data);
      assert.deepEqual(types.map((type) => type.id).sort(), [unitType.id, extra.id].sort());
      assert.ok(types.every((type) => !("facilityId" in type)));
      const page = await app.inject(`/api/facilities/${facilityA.id}/unit-types?limit=1&offset=1`);
      assert.equal(page.statusCode, 200);
      assert.deepEqual(page.json().data, body.data.slice(1, 2));
      const other = await app.inject(`/api/facilities/${facilityB.id}/unit-types`);
      assert.equal(other.statusCode, 200);
      assert.deepEqual(
        other.json().data.map((type: { id: string }) => type.id),
        [unitType.id],
      );
      const empty = await app.inject(`/api/facilities/${facilityC.id}/unit-types`);
      assert.equal(empty.statusCode, 200);
      assert.deepEqual(empty.json().data, []);
      const missing = await app.inject(`/api/facilities/${randomUUID()}/unit-types`);
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.json().error.code, "NOT_FOUND");
      await db.update(facilities).set({ isActive: false }).where(eq(facilities.id, facilityA.id));
      const disabled = await app.inject(`/api/facilities/${facilityA.id}/unit-types`);
      assert.equal(disabled.statusCode, 404);
      for (const path of [
        "/api/facilities/not-a-uuid/unit-types",
        `/api/facilities/${facilityB.id}/unit-types?limit=0`,
        `/api/facilities/${facilityB.id}/unit-types?limit=101`,
        `/api/facilities/${facilityB.id}/unit-types?offset=-1`,
        `/api/facilities/${facilityB.id}/unit-types?limit=invalid`,
      ]) {
        const invalid = await app.inject(path);
        assert.equal(invalid.statusCode, 400);
        assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
      }
    } finally {
      await app.close();
    }
  });
});
