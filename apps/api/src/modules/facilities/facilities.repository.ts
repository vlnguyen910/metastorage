import {
  and,
  type Database,
  desc,
  eq,
  exists,
  type Facility,
  type FacilityAssignment,
  facilities,
  facilityAssignments,
  gt,
  isNull,
  type NewFacility,
  type NewFacilityAssignment,
  or,
  sql,
  users,
} from "@metastorage/database";
import type { AssignedFacilityScope, FacilityListScope, FacilityScope } from "./facilities.access";

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
      throw new Error("Failed to create facility");
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
      throw new Error("Failed to upsert assignment");
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
}
