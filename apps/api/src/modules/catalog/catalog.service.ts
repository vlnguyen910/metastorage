import type { CatalogFacility, CatalogUnitType, PaginatedResult } from "@metastorage/contracts";
import { NotFoundError } from "../../common/errors/app-error";
import { CATALOG_MESSAGES } from "./catalog.messages";
import type { CatalogRepository, CatalogRow } from "./catalog.repository";
import type { CatalogFacilityQuery } from "./catalog.schema";

function isAvailable(row: CatalogRow): boolean {
  return row.storageUnit.status === "AVAILABLE";
}

function toFacility(row: CatalogRow, rows: CatalogRow[]): CatalogFacility {
  const availableUnits = rows.filter(isAvailable);
  const prices = availableUnits.map((item) => item.unitType.monthlyPrice);
  return {
    id: row.facility.id,
    code: row.facility.code,
    name: row.facility.name,
    address: row.facility.address,
    description: row.facility.description,
    availableUnits: availableUnits.length,
    totalUnits: rows.length,
    startingMonthlyPrice: Math.min(...prices),
    createdAt: row.facility.createdAt.toISOString(),
    updatedAt: row.facility.updatedAt.toISOString(),
  };
}

function groupUnitTypes(facilityId: string, rows: CatalogRow[]): CatalogUnitType[] {
  const groups = new Map<string, CatalogUnitType>();
  for (const row of rows) {
    const unitType = row.unitType;
    const key = unitType.id;
    const existing = groups.get(key);
    if (existing) {
      if (isAvailable(row)) existing.availableCount += 1;
      continue;
    }
    groups.set(key, {
      facilityId,
      unitTypeId: unitType.id,
      unitType: unitType.name,
      sizeLabel: unitType.sizeLabel,
      sizeSqm: unitType.sizeSqm,
      monthlyPrice: unitType.monthlyPrice,
      availableCount: isAvailable(row) ? 1 : 0,
    });
  }
  return [...groups.values()].sort(
    (left, right) => left.monthlyPrice - right.monthlyPrice || left.sizeSqm - right.sizeSqm,
  );
}

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async listFacilities(query: CatalogFacilityQuery): Promise<PaginatedResult<CatalogFacility>> {
    const rows = await this.repository.listFacilities(query);
    const total = rows[0]?.total ?? 0;
    return {
      items: rows.map((row) => ({
        id: row.facility.id,
        code: row.facility.code,
        name: row.facility.name,
        address: row.facility.address,
        description: row.facility.description,
        availableUnits: row.availableUnits,
        totalUnits: row.totalUnits,
        startingMonthlyPrice: row.startingMonthlyPrice,
        createdAt: row.facility.createdAt.toISOString(),
        updatedAt: row.facility.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getFacility(facilityId: string): Promise<CatalogFacility> {
    const rows = await this.repository.findRows(facilityId);
    if (!rows.length || !rows.some(isAvailable)) {
      throw new NotFoundError(CATALOG_MESSAGES.availableFacilityNotFound);
    }
    const first = rows[0];
    if (!first) throw new NotFoundError(CATALOG_MESSAGES.availableFacilityNotFound);
    return toFacility(first, rows);
  }

  async getUnitTypes(facilityId: string): Promise<CatalogUnitType[]> {
    const rows = await this.repository.findRows(facilityId);
    if (!rows.length || !rows.some(isAvailable)) {
      throw new NotFoundError(CATALOG_MESSAGES.availableFacilityNotFound);
    }
    return groupUnitTypes(facilityId, rows);
  }
}
