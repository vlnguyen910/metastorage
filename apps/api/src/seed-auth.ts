import { randomUUID } from "node:crypto";
import { accounts, and, db, eq, facilities, facilityAssignments, users } from "@storex/database";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./modules/auth/auth";

const DEMO_EMAIL = "manager@storex.vn";
const DEMO_PASSWORD = "Demo@123";

async function seedBetterAuth() {
  console.log(`Seeding Better-Auth user '${DEMO_EMAIL}'...`);

  try {
    const res = await auth.api.signUpEmail({
      body: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        name: "Lê Thu Hà (Facility Manager)",
      },
    });
    console.log("User created via Better-Auth:", res.user.id);
  } catch (err: unknown) {
    console.log("Sign up message:", err instanceof Error ? err.message : err);
  }

  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));

  if (user) {
    // signUpEmail does not change the password when the user already exists.
    // Keep this local fixture idempotent by updating the credential account
    // with a Better Auth-compatible hash on every run.
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const [credentialAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));

    if (credentialAccount) {
      await db
        .update(accounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(accounts.id, credentialAccount.id));
      console.log(`Reset credential password for ${DEMO_EMAIL}`);
    } else {
      await db.insert(accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      });
      console.log(`Created credential account for ${DEMO_EMAIL}`);
    }

    await db
      .update(users)
      .set({ role: "FACILITY_MANAGER", status: "ACTIVE", emailVerified: true })
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
