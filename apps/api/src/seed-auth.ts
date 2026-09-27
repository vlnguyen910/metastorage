import { db, eq, facilities, facilityAssignments, users } from "@storex/database";
import { auth } from "./modules/auth/auth";

async function seedBetterAuth() {
  console.log("Seeding Better-Auth user 'manager@storex.vn' with password 'Demo@123'...");

  try {
    const res = await auth.api.signUpEmail({
      body: {
        email: "manager@storex.vn",
        password: "Demo@123",
        name: "Lê Thu Hà (Facility Manager)",
      },
    });
    console.log("User created via Better-Auth:", res.user.id);
  } catch (err: unknown) {
    console.log("Sign up message:", err instanceof Error ? err.message : err);
  }

  const [user] = await db.select().from(users).where(eq(users.email, "manager@storex.vn"));

  if (user) {
    await db
      .update(users)
      .set({ role: "FACILITY_MANAGER", status: "ACTIVE" })
      .where(eq(users.id, user.id));

    console.log(`Updated user ${user.email} with role FACILITY_MANAGER`);

    const [facility] = await db.select().from(facilities).limit(1);
    if (facility) {
      const [existing] = await db
        .select()
        .from(facilityAssignments)
        .where(eq(facilityAssignments.userId, user.id));

      if (!existing) {
        await db.insert(facilityAssignments).values({
          userId: user.id,
          facilityId: facility.id,
          role: "FACILITY_MANAGER",
          isActive: true,
        });
        console.log(`Assigned user ${user.email} to facility ${facility.name}`);
      }
    }
  }

  process.exit(0);
}

seedBetterAuth().catch((err) => {
  console.error(err);
  process.exit(1);
});
