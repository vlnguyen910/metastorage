import {
  and,
  asc,
  type Database,
  desc,
  eq,
  facilities,
  facilityUnitTypes,
  ilike,
  or,
  sql,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import type { CatalogFacilityQuery } from "./catalog.schema";

export type CatalogRow = {
  facility: typeof facilities.$inferSelect;
  unitType: typeof unitTypes.$inferSelect;
  storageUnit: typeof storageUnits.$inferSelect;
};

export type CatalogFacilitySummary = {
  facility: typeof facilities.$inferSelect;
  totalUnits: number;
  availableUnits: number;
  startingMonthlyPrice: number;
  total: number;
};

export class CatalogRepository {
  constructor(private readonly db: Database) {}

  async listFacilities(query: CatalogFacilityQuery): Promise<CatalogFacilitySummary[]> {
    const filters = [eq(facilities.isActive, true)];
    if (query.search) {
      const searchFilter = or(
        ilike(facilities.name, `%${query.search}%`),
        ilike(facilities.address, `%${query.search}%`),
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (query.city) filters.push(ilike(facilities.address, `%${query.city}%`));

    const totalUnits = sql<number>`count(${storageUnits.id})`.mapWith(Number);
    const availableUnits =
      sql<number>`count(*) filter (where ${storageUnits.status} = 'AVAILABLE')`.mapWith(Number);
    const startingMonthlyPrice =
      sql<number>`min(${unitTypes.monthlyPrice}) filter (where ${storageUnits.status} = 'AVAILABLE')`.mapWith(
        Number,
      );
    const total = sql<number>`count(*) over ()`.mapWith(Number);

    const rows = await this.db
      .select({
        facility: facilities,
        totalUnits,
        availableUnits,
        startingMonthlyPrice,
        total,
      })
      .from(facilities)
      .innerJoin(storageUnits, eq(storageUnits.facilityId, facilities.id))
      .innerJoin(
        facilityUnitTypes,
        and(
          eq(facilityUnitTypes.facilityId, storageUnits.facilityId),
          eq(facilityUnitTypes.unitTypeId, storageUnits.unitTypeId),
        ),
      )
      .innerJoin(unitTypes, eq(storageUnits.unitTypeId, unitTypes.id))
      .where(and(...filters, eq(unitTypes.isActive, true), eq(facilityUnitTypes.isActive, true)))
      .groupBy(facilities.id)
      .having(sql`count(*) filter (where ${storageUnits.status} = 'AVAILABLE') > 0`)
      .orderBy(
        query.sort === "price"
          ? asc(startingMonthlyPrice)
          : query.sort === "availability"
            ? desc(availableUnits)
            : asc(facilities.name),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return rows;
  }

  async findRows(facilityId: string): Promise<CatalogRow[]> {
    return this.db
      .select({ facility: facilities, unitType: unitTypes, storageUnit: storageUnits })
      .from(facilities)
      .innerJoin(storageUnits, eq(storageUnits.facilityId, facilities.id))
      .innerJoin(
        facilityUnitTypes,
        and(
          eq(facilityUnitTypes.facilityId, storageUnits.facilityId),
          eq(facilityUnitTypes.unitTypeId, storageUnits.unitTypeId),
        ),
      )
      .innerJoin(unitTypes, eq(storageUnits.unitTypeId, unitTypes.id))
      .where(
        and(
          eq(facilities.id, facilityId),
          eq(facilities.isActive, true),
          eq(unitTypes.isActive, true),
          eq(facilityUnitTypes.isActive, true),
        ),
      );
  }
}
