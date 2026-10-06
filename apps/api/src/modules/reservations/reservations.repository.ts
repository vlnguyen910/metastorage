import type { NewReservationDraft } from "@metastorage/database";
import {
  and,
  capacityAllocations,
  count,
  type Database,
  eq,
  facilities,
  facilityOperatingHours,
  facilityUnitTypes,
  gt,
  isNull,
  lt,
  notInArray,
  or,
  reservationDrafts,
  storageUnits,
  unitTypes,
} from "@metastorage/database";
import { RESERVATION_MESSAGES } from "./reservations.messages";

export class ReservationsRepository {
  constructor(private readonly db: Database) {}

  async findActiveContext(facilityId: string, unitTypeId: string) {
    const [context] = await this.db
      .select({ facility: facilities, unitType: unitTypes })
      .from(facilities)
      .innerJoin(facilityUnitTypes, eq(facilityUnitTypes.facilityId, facilities.id))
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
      .where(
        and(
          eq(facilities.id, facilityId),
          eq(facilities.isActive, true),
          eq(unitTypes.id, unitTypeId),
          eq(facilityUnitTypes.isActive, true),
          eq(unitTypes.isActive, true),
        ),
      );
    return context;
  }

  async findOperatingHours(facilityId: string, dayOfWeek: number) {
    const [hours] = await this.db
      .select()
      .from(facilityOperatingHours)
      .where(
        and(
          eq(facilityOperatingHours.facilityId, facilityId),
          eq(facilityOperatingHours.dayOfWeek, dayOfWeek),
        ),
      );
    return hours;
  }

  async countCapacity(
    facilityId: string,
    unitTypeId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<number> {
    const [inventory] = await this.db
      .select({ count: count(storageUnits.id) })
      .from(storageUnits)
      .where(
        and(
          eq(storageUnits.unitTypeId, unitTypeId),
          eq(storageUnits.facilityId, facilityId),
          notInArray(storageUnits.status, ["INACTIVE", "LOCKED", "MAINTENANCE"]),
        ),
      );
    const [allocated] = await this.db
      .select({ count: count(capacityAllocations.id) })
      .from(capacityAllocations)
      .where(
        and(
          eq(capacityAllocations.unitTypeId, unitTypeId),
          eq(capacityAllocations.facilityId, facilityId),
          eq(capacityAllocations.status, "ACTIVE"),
          lt(capacityAllocations.startsAt, endsAt),
          gt(capacityAllocations.endsAt, startsAt),
          or(isNull(capacityAllocations.expiresAt), gt(capacityAllocations.expiresAt, new Date())),
        ),
      );
    return Math.max(0, Number(inventory?.count ?? 0) - Number(allocated?.count ?? 0));
  }

  async createDraft(data: NewReservationDraft) {
    return this.db.transaction(async (tx) => {
      const [draft] = await tx.insert(reservationDrafts).values(data).returning();
      if (!draft) throw new Error(RESERVATION_MESSAGES.failedToCreateDraft);
      return draft;
    });
  }

  async createHold(draftId: string, accessTokenHash: string) {
    return this.db.transaction(async (tx) => {
      const [draft] = await tx
        .select()
        .from(reservationDrafts)
        .where(eq(reservationDrafts.id, draftId))
        .for("update");
      if (!draft || draft.accessTokenHash !== accessTokenHash) return null;

      const now = new Date();
      const [existing] = await tx
        .select()
        .from(capacityAllocations)
        .where(
          and(
            eq(capacityAllocations.referenceId, draft.id),
            eq(capacityAllocations.kind, "HOLD"),
            eq(capacityAllocations.status, "ACTIVE"),
          ),
        )
        .for("update");
      if (existing?.expiresAt && existing.expiresAt > now) return existing;
      if (existing) {
        await tx
          .update(capacityAllocations)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(capacityAllocations.id, existing.id));
      }

      const inventory = await tx
        .select({ id: storageUnits.id })
        .from(storageUnits)
        .where(
          and(
            eq(storageUnits.unitTypeId, draft.unitTypeId),
            eq(storageUnits.facilityId, draft.facilityId),
            notInArray(storageUnits.status, ["INACTIVE", "LOCKED", "MAINTENANCE"]),
          ),
        )
        .for("update");
      const allocations = await tx
        .select({ id: capacityAllocations.id })
        .from(capacityAllocations)
        .where(
          and(
            eq(capacityAllocations.unitTypeId, draft.unitTypeId),
            eq(capacityAllocations.facilityId, draft.facilityId),
            eq(capacityAllocations.status, "ACTIVE"),
            lt(capacityAllocations.startsAt, draft.rentalEndAt),
            gt(capacityAllocations.endsAt, draft.checkInAt),
            or(isNull(capacityAllocations.expiresAt), gt(capacityAllocations.expiresAt, now)),
          ),
        )
        .for("update");
      if (allocations.length >= inventory.length) return undefined;

      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      const [hold] = await tx
        .insert(capacityAllocations)
        .values({
          facilityId: draft.facilityId,
          unitTypeId: draft.unitTypeId,
          referenceId: draft.id,
          accessTokenHash: draft.accessTokenHash,
          kind: "HOLD",
          status: "ACTIVE",
          startsAt: draft.checkInAt,
          endsAt: draft.rentalEndAt,
          expiresAt,
        })
        .returning();
      return hold;
    });
  }
}
