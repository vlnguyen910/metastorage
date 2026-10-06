import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CatalogRepository,
  CatalogRow,
} from "../../../src/modules/catalog/catalog.repository";
import { CatalogService } from "../../../src/modules/catalog/catalog.service";

function row(
  overrides: Partial<CatalogRow["storageUnit"]> = {},
  facilityOverrides: Partial<CatalogRow["facility"]> = {},
): CatalogRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    facility: {
      id: "00000000-0000-0000-0000-000000000001",
      code: "HCM-01",
      name: "Central",
      address: "District 7, Ho Chi Minh City",
      description: "Storage facility",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...facilityOverrides,
    },
    unitType: {
      id: "00000000-0000-0000-0000-000000000003",
      facilityId: "00000000-0000-0000-0000-000000000001",
      code: "STANDARD-2",
      name: "Standard",
      sizeLabel: "2 m²",
      lengthM: 2,
      widthM: 1,
      heightM: 2.5,
      sizeCbm: 5,
      monthlyPrice: 900000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    storageUnit: {
      id: "00000000-0000-0000-0000-000000000002",
      facilityId: "00000000-0000-0000-0000-000000000001",
      code: "HCM-01-001",
      unitType: "Standard",
      sizeLabel: "2 m²",
      sizeSqm: 2,
      monthlyPrice: 900000,
      status: "AVAILABLE",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
  } as CatalogRow;
}

describe("catalog service", () => {
  it("filters facilities without available units and groups unit type counts", async () => {
    const rows = [
      row(),
      row({ id: "unit-2", code: "HCM-01-002", status: "OCCUPIED" }),
      row({ id: "unit-3", code: "HCM-01-003", sizeLabel: "4 m²", sizeSqm: 4 }),
      row(
        { id: "unit-4", code: "HCM-02-001", status: "OCCUPIED" },
        {
          id: "00000000-0000-0000-0000-000000000010",
          code: "HN-01",
          name: "Empty",
        },
      ),
    ];
    const repository = {
      listFacilities: async () => [
        {
          facility: rows[0]?.facility,
          totalUnits: 3,
          availableUnits: 2,
          startingMonthlyPrice: 900000,
          total: 1,
        },
      ],
      findRows: async () => rows.slice(0, 3),
    } as unknown as CatalogRepository;

    const service = new CatalogService(repository);
    const result = await service.listFacilities({
      page: 1,
      pageSize: 10,
      sort: "name",
    });
    const unitTypes = await service.getUnitTypes("00000000-0000-0000-0000-000000000001");

    assert.equal(result.total, 1);
    assert.equal(result.items[0]?.availableUnits, 2);
    assert.equal(result.items[0]?.totalUnits, 3);
    assert.equal(unitTypes[0]?.sizeSqm, 2);
    assert.deepEqual(
      unitTypes.map(({ sizeLabel, availableCount }) => ({ sizeLabel, availableCount })),
      [{ sizeLabel: "2 m²", availableCount: 2 }],
    );
  });

  it("throws not found for inactive or fully unavailable facilities", async () => {
    const repository = {
      listFacilities: async () => [],
      findRows: async () => [row({ status: "OCCUPIED" })],
    } as unknown as CatalogRepository;
    const service = new CatalogService(repository);

    await assert.rejects(() => service.getFacility("facility-id"), { name: "NotFoundError" });
    await assert.rejects(() => service.getUnitTypes("facility-id"), { name: "NotFoundError" });
  });
});
