import {
  and,
  type Database,
  desc,
  eq,
  facilityAssignments,
  type Role,
  type User,
  users,
} from "@metastorage/database";

export class UsersRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async findAssignedFacilityIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ facilityId: facilityAssignments.facilityId })
      .from(facilityAssignments)
      .where(and(eq(facilityAssignments.userId, userId), eq(facilityAssignments.isActive, true)));
    return rows.map((r) => r.facilityId);
  }

  async list(limit: number, offset: number): Promise<User[]> {
    return this.db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
  }

  async updateRole(id: string, role: Role): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}
