import {
  and,
  capacityAllocations,
  count,
  type Database,
  eq,
  gt,
  isNull,
  lt,
  notInArray,
  or,
  type StorageUnit,
  storageUnits,
} from "@metastorage/database";

export class StorageUnitsRepository {
  constructor(private readonly db: Database) {}

  async countInventory(
    facilityId: string,
    unitTypeId: string,
    excludedStatuses: StorageUnit["status"][],
  ) {
    const [row] = await this.db
      .select({ count: count(storageUnits.id) })
      .from(storageUnits)
      .where(
        and(
          eq(storageUnits.facilityId, facilityId),
          eq(storageUnits.unitTypeId, unitTypeId),
          notInArray(storageUnits.status, excludedStatuses),
        ),
      );
    return Number(row?.count ?? 0);
  }

  async countActiveAllocations(
    facilityId: string,
    unitTypeId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const [row] = await this.db
      .select({ count: count(capacityAllocations.id) })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.facilityId, facilityId),
          eq(capacityAllocations.unitTypeId, unitTypeId),
          eq(capacityAllocations.status, "ACTIVE"),
          lt(capacityAllocations.startsAt, endsAt),
          gt(capacityAllocations.endsAt, startsAt),
          or(isNull(capacityAllocations.expiresAt), gt(capacityAllocations.expiresAt, new Date())),
        ),
      );
    return Number(row?.count ?? 0);
  }
}
