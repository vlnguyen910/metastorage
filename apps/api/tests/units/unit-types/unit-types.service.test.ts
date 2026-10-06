import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UnitType } from "@metastorage/database";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import type { UnitTypesRepository } from "../../../src/modules/unit-types/unit-types.repository";
import { UnitTypesService } from "../../../src/modules/unit-types/unit-types.service";

const facilityId = "00000000-0000-4000-8000-000000000001";
const unitType: UnitType = {
  id: "00000000-0000-4000-8000-000000000002",
  code: "SMALL",
  name: "Small unit",
  sizeLabel: "2 m²",
  sizeSqm: 2,
  monthlyPrice: 900000,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

function fixture(facility: { id: string; isActive: boolean } | undefined, rows = [unitType]) {
  const calls: unknown[][] = [];
  const unitTypesRepository = {
    listByFacility: async (...args: unknown[]) => {
      calls.push(args);
      return rows;
    },
  } as unknown as UnitTypesRepository;
  const facilitiesRepository = {
    findById: async () => facility,
  } as unknown as FacilitiesRepository;
  return { service: new UnitTypesService(unitTypesRepository, facilitiesRepository), calls };
}

describe("UnitTypesService.listByFacility", () => {
  it("returns DTOs and forwards the selected facility and pagination", async () => {
    const { service, calls } = fixture({ id: facilityId, isActive: true });
    const result = await service.listByFacility(facilityId, { limit: 10, offset: 2 });
    assert.deepEqual(calls, [[facilityId, 10, 2]]);
    assert.deepEqual(result, [
      {
        ...unitType,
        createdAt: unitType.createdAt.toISOString(),
        updatedAt: unitType.updatedAt.toISOString(),
      },
    ]);
  });

  it("returns an empty list when the facility has no active offerings", async () => {
    const { service } = fixture({ id: facilityId, isActive: true }, []);
    assert.deepEqual(await service.listByFacility(facilityId, { limit: 20, offset: 0 }), []);
  });

  for (const facility of [undefined, { id: facilityId, isActive: false }]) {
    it(`rejects a ${facility ? "disabled" : "missing"} facility before listing unit types`, async () => {
      const { service, calls } = fixture(facility);
      await assert.rejects(() => service.listByFacility(facilityId, { limit: 20, offset: 0 }), {
        code: "NOT_FOUND",
      });
      assert.equal(calls.length, 0);
    });
  }
});
