import type { StorageUnit } from "@metastorage/database";
import type { StorageUnitsRepository } from "./storage-units.repository";

// Preserve checkout inventory policy; physical assignment also excludes INSPECTION.
const CAPACITY_EXCLUDED_STATUSES: StorageUnit["status"][] = ["INACTIVE", "LOCKED", "MAINTENANCE"];

export class StorageUnitsService {
  constructor(private readonly repository: StorageUnitsRepository) {}

  async getAvailableCapacity(facilityId: string, unitTypeId: string, startsAt: Date, endsAt: Date) {
    const [inventory, allocated] = await Promise.all([
      this.repository.countInventory(facilityId, unitTypeId, CAPACITY_EXCLUDED_STATUSES),
      this.repository.countActiveAllocations(facilityId, unitTypeId, startsAt, endsAt),
    ]);
    return Math.max(0, inventory - allocated);
  }
}
