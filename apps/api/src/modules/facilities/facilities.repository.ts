import type { StorageUnitStatus } from "@metastorage/contracts";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  exists,
  type Facility,
  type FacilityAssignment,
  facilities,
  facilityAssignments,
  gt,
  ilike,
  isNull,
  type NewFacility,
  type NewFacilityAssignment,
  or,
  rentals,
  type StorageUnit,
  sql,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import type { AssignedFacilityScope, FacilityListScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";

export class FacilitiesRepository {
  constructor(private readonly db: Database) {}

  private activeAssignmentExists(
    facilityId: string | typeof facilities.id,
    scope: AssignedFacilityScope,
  ) {
    const facilityCondition =
      typeof facilityId === "string"
        ? eq(facilityAssignments.facilityId, facilityId)
        : eq(facilityAssignments.facilityId, facilityId);

    return exists(
      this.db
        .select({ one: sql`1` })
        .from(facilityAssignments)
        .where(
          and(
            facilityCondition,
            eq(facilityAssignments.userId, scope.userId),
            eq(facilityAssignments.role, scope.role),
            eq(facilityAssignments.isActive, true),
            or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          ),
        ),
    );
  }

  async createFacility(data: NewFacility): Promise<Facility> {
    const [created] = await this.db.insert(facilities).values(data).returning();
    if (!created) {
      throw new Error(FACILITY_MESSAGES.failedToCreateFacility);
    }
    return created;
  }

  async findById(id: string): Promise<Facility | undefined> {
    const [facility] = await this.db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async findAccessibleById(id: string, scope: FacilityScope): Promise<Facility | undefined> {
    const [facility] = await this.db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.id, id),
          scope.kind === "assigned" ? this.activeAssignmentExists(facilities.id, scope) : undefined,
        ),
      );
    return facility;
  }

  async findByCode(code: string): Promise<Facility | undefined> {
    const [facility] = await this.db.select().from(facilities).where(eq(facilities.code, code));
    return facility;
  }

  async listAccessible(
    limit: number,
    offset: number,
    isActive: boolean | undefined,
    scope: FacilityListScope,
  ): Promise<Facility[]> {
    return this.db
      .select()
      .from(facilities)
      .where(
        and(
          isActive === undefined ? undefined : eq(facilities.isActive, isActive),
          scope.kind === "assigned" ? this.activeAssignmentExists(facilities.id, scope) : undefined,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(facilities.createdAt));
  }

  async updateAccessible(
    id: string,
    data: Partial<NewFacility>,
    scope: FacilityScope,
  ): Promise<Facility | undefined> {
    const [updated] = await this.db
      .update(facilities)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(facilities.id, id),
          scope.kind === "assigned" ? this.activeAssignmentExists(id, scope) : undefined,
        ),
      )
      .returning();
    return updated;
  }

  async findActiveAssignment(
    facilityId: string,
    userId: string,
    role: AssignedFacilityScope["role"],
  ): Promise<FacilityAssignment | undefined> {
    const [assignment] = await this.db
      .select()
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );
    return assignment;
  }

  async findAssignment(
    facilityId: string,
    userId: string,
  ): Promise<FacilityAssignment | undefined> {
    const [assignment] = await this.db
      .select()
      .from(facilityAssignments)
      .where(
        and(eq(facilityAssignments.facilityId, facilityId), eq(facilityAssignments.userId, userId)),
      );
    return assignment;
  }

  async upsertAssignment(data: NewFacilityAssignment): Promise<FacilityAssignment> {
    const [assignment] = await this.db
      .insert(facilityAssignments)
      .values(data)
      .onConflictDoUpdate({
        target: [facilityAssignments.userId, facilityAssignments.facilityId],
        set: {
          role: data.role,
          isActive: true,
          endedAt: null,
          assignedAt: new Date(),
        },
      })
      .returning();
    if (!assignment) {
      throw new Error(FACILITY_MESSAGES.failedToUpsertAssignment);
    }
    return assignment;
  }

  async deactivateAssignment(
    facilityId: string,
    userId: string,
  ): Promise<FacilityAssignment | undefined> {
    const [deactivated] = await this.db
      .update(facilityAssignments)
      .set({
        isActive: false,
        endedAt: new Date(),
      })
      .where(
        and(eq(facilityAssignments.facilityId, facilityId), eq(facilityAssignments.userId, userId)),
      )
      .returning();
    return deactivated;
  }

  async listAssignmentsWithUsers(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ): Promise<
    Array<{
      assignment: FacilityAssignment;
      userName: string;
      userEmail: string;
    }>
  > {
    const rows = await this.db
      .select({
        assignment: facilityAssignments,
        userName: users.name,
        userEmail: users.email,
      })
      .from(facilityAssignments)
      .innerJoin(users, eq(facilityAssignments.userId, users.id))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          scope.kind === "assigned" ? this.activeAssignmentExists(facilityId, scope) : undefined,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(facilityAssignments.assignedAt));

    return rows;
  }

  async listUserAssignmentsWithFacilities(
    userId: string,
    role: AssignedFacilityScope["role"],
  ): Promise<
    Array<{
      assignment: FacilityAssignment;
      facilityName: string;
      facilityCode: string;
    }>
  > {
    const rows = await this.db
      .select({
        assignment: facilityAssignments,
        facilityName: facilities.name,
        facilityCode: facilities.code,
      })
      .from(facilityAssignments)
      .innerJoin(facilities, eq(facilityAssignments.facilityId, facilities.id))
      .where(
        and(
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .orderBy(desc(facilityAssignments.assignedAt));

    return rows;
  }

  async listFacilityUnits(
    facilityId: string,
    filters: {
      status?: StorageUnitStatus;
      unitTypeId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    scope: FacilityScope,
  ): Promise<
    Array<{
      unit: StorageUnit;
      unitTypeName: string;
      unitTypeSize: number;
      monthlyPrice: number;
      currentBookingId?: string | null;
      currentBookingCode?: string | null;
    }>
  > {
    const conditions = [
      eq(storageUnits.facilityId, facilityId),
      scope.kind === "assigned" ? this.activeAssignmentExists(facilityId, scope) : undefined,
    ];

    if (filters.status) {
      conditions.push(eq(storageUnits.status, filters.status));
    }
    if (filters.unitTypeId) {
      conditions.push(eq(storageUnits.unitTypeId, filters.unitTypeId));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(storageUnits.code, `%${filters.search}%`),
          ilike(storageUnits.locationDescription, `%${filters.search}%`),
          ilike(storageUnits.floor, `%${filters.search}%`),
        ),
      );
    }

    const rows = await this.db
      .select({
        unit: storageUnits,
        unitTypeName: unitTypes.name,
        unitTypeSize: unitTypes.sizeSqm,
        monthlyPrice: unitTypes.monthlyPrice,
        currentBookingId: bookings.id,
        currentBookingCode: bookings.bookingCode,
      })
      .from(storageUnits)
      .innerJoin(unitTypes, eq(storageUnits.unitTypeId, unitTypes.id))
      .leftJoin(
        unitAssignments,
        and(
          eq(unitAssignments.physicalUnitId, storageUnits.id),
          eq(unitAssignments.status, "ACTIVE"),
          or(isNull(unitAssignments.endedAt), gt(unitAssignments.endedAt, new Date())),
        ),
      )
      .leftJoin(bookings, eq(unitAssignments.bookingId, bookings.id))
      .where(and(...conditions))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0)
      .orderBy(storageUnits.code);

    return rows;
  }

  async findUnitById(unitId: string): Promise<StorageUnit | undefined> {
    const [unit] = await this.db.select().from(storageUnits).where(eq(storageUnits.id, unitId));
    return unit;
  }

  async findUnitWithDetailsById(unitId: string): Promise<
    | {
        unit: StorageUnit;
        unitTypeName: string;
        unitTypeSize: number;
        monthlyPrice: number;
      }
    | undefined
  > {
    const [row] = await this.db
      .select({
        unit: storageUnits,
        unitTypeName: unitTypes.name,
        unitTypeSize: unitTypes.sizeSqm,
        monthlyPrice: unitTypes.monthlyPrice,
      })
      .from(storageUnits)
      .innerJoin(unitTypes, eq(storageUnits.unitTypeId, unitTypes.id))
      .where(eq(storageUnits.id, unitId));

    return row;
  }

  async hasActiveAssignmentOrRental(unitId: string): Promise<boolean> {
    const [assignment] = await this.db
      .select({ one: sql`1` })
      .from(unitAssignments)
      .where(
        and(
          eq(unitAssignments.physicalUnitId, unitId),
          eq(unitAssignments.status, "ACTIVE"),
          or(isNull(unitAssignments.endedAt), gt(unitAssignments.endedAt, new Date())),
        ),
      )
      .limit(1);

    if (assignment) return true;

    const [rental] = await this.db
      .select({ one: sql`1` })
      .from(rentals)
      .where(and(eq(rentals.physicalUnitId, unitId), eq(rentals.status, "ACTIVE")))
      .limit(1);

    return Boolean(rental);
  }

  async updateUnitStatus(
    unitId: string,
    status: StorageUnitStatus,
  ): Promise<StorageUnit | undefined> {
    const [updated] = await this.db
      .update(storageUnits)
      .set({ status, updatedAt: new Date() })
      .where(eq(storageUnits.id, unitId))
      .returning();
    return updated;
  }
}
