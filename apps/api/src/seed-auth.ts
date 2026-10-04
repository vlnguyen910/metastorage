import { randomUUID } from "node:crypto";
import {
  accounts,
  and,
  db,
  eq,
  facilities,
  facilityAssignments,
  users,
} from "@metastorage/database";
import { hashPassword } from "better-auth/crypto";

const DEMO_PASSWORD = "Demo@123";

interface DemoUserSeed {
  email: string;
  name: string;
  role:
    | "CUSTOMER"
    | "FACILITY_STAFF"
    | "FACILITY_MANAGER"
    | "BUSINESS_OPERATION_MANAGER"
    | "SYSTEM_ADMIN";
  facilityCodes: string[];
}

const DEMO_USERS: DemoUserSeed[] = [
  // Single Facility Manager
  {
    email: "manager@metastorage.test",
    name: "Lê Thu Hà (Facility Manager)",
    role: "FACILITY_MANAGER",
    facilityCodes: ["HCM-01"],
  },
  {
    email: "manager@storex.vn",
    name: "Lê Thu Hà (Facility Manager)",
    role: "FACILITY_MANAGER",
    facilityCodes: ["HCM-01"],
  },
  // Multi Facility Manager
  {
    email: "multi-manager@metastorage.test",
    name: "Ngô Hoàng Long (Multi Facility Manager)",
    role: "FACILITY_MANAGER",
    facilityCodes: ["HCM-01", "HN-01"],
  },
  {
    email: "multi-manager@storex.vn",
    name: "Ngô Hoàng Long (Multi Facility Manager)",
    role: "FACILITY_MANAGER",
    facilityCodes: ["HCM-01", "HN-01"],
  },
  // Facility Staff
  {
    email: "staff@metastorage.test",
    name: "Trần Quốc Huy (Facility Staff)",
    role: "FACILITY_STAFF",
    facilityCodes: ["HCM-01"],
  },
  {
    email: "staff@storex.vn",
    name: "Trần Quốc Huy (Facility Staff)",
    role: "FACILITY_STAFF",
    facilityCodes: ["HCM-01"],
  },
  // Customer
  {
    email: "customer@metastorage.test",
    name: "Nguyễn Minh Anh (Customer)",
    role: "CUSTOMER",
    facilityCodes: [],
  },
  {
    email: "customer@storex.vn",
    name: "Nguyễn Minh Anh (Customer)",
    role: "CUSTOMER",
    facilityCodes: [],
  },
  // Business Operations Manager
  {
    email: "operations@metastorage.test",
    name: "Phạm Hải Nam (Operations)",
    role: "BUSINESS_OPERATION_MANAGER",
    facilityCodes: [],
  },
  {
    email: "operations@storex.vn",
    name: "Phạm Hải Nam (Operations)",
    role: "BUSINESS_OPERATION_MANAGER",
    facilityCodes: [],
  },
  // System Admin
  {
    email: "admin@metastorage.test",
    name: "Đỗ An Nhiên (Admin)",
    role: "SYSTEM_ADMIN",
    facilityCodes: [],
  },
  {
    email: "admin@storex.vn",
    name: "Đỗ An Nhiên (Admin)",
    role: "SYSTEM_ADMIN",
    facilityCodes: [],
  },
];

async function seedBetterAuth() {
  console.log("1. Ensuring demo facilities exist in database...");

  const demoFacilities = [
    {
      code: "HCM-01",
      name: "metastorage Sài Gòn Central",
      address: "118 Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh",
      description: "Kho trung tâm thuận tiện cho gia đình và doanh nghiệp nhỏ, kiểm soát 24/7.",
      isActive: true,
    },
    {
      code: "HN-01",
      name: "metastorage Hà Nội West",
      address: "42 Lê Quang Đạo, Phường Phú Đô, Quận Nam Từ Liêm, Hà Nội",
      description: "Không gian lưu trữ sạch, khô thoáng ở phía Tây Hà Nội.",
      isActive: true,
    },
    {
      code: "DN-01",
      name: "metastorage Đà Nẵng Riverside",
      address: "95 Ngô Quyền, Phường An Hải Bắc, Quận Sơn Trà, Đà Nẵng",
      description: "Cơ sở mới gần trung tâm thành phố.",
      isActive: true,
    },
  ];

  for (const fac of demoFacilities) {
    const [existing] = await db.select().from(facilities).where(eq(facilities.code, fac.code));
    if (!existing) {
      await db.insert(facilities).values(fac);
      console.log(`Created facility: ${fac.name} (${fac.code})`);
    } else {
      await db
        .update(facilities)
        .set({ name: fac.name, address: fac.address, isActive: true })
        .where(eq(facilities.code, fac.code));
    }
  }

  const allFacilities = await db.select().from(facilities);
  const facilityMap = new Map(allFacilities.map((f) => [f.code, f.id]));

  console.log("2. Seeding demo users and Better Auth credentials...");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const demo of DEMO_USERS) {
    let [user] = await db.select().from(users).where(eq(users.email, demo.email));

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          email: demo.email,
          name: demo.name,
          role: demo.role,
          status: "ACTIVE",
          emailVerified: true,
        })
        .returning();
      user = created;
      console.log(`Created user: ${demo.email} [${demo.role}]`);
    } else {
      await db
        .update(users)
        .set({
          name: demo.name,
          role: demo.role,
          status: "ACTIVE",
          emailVerified: true,
        })
        .where(eq(users.id, user.id));
      console.log(`Updated user: ${demo.email} [${demo.role}]`);
    }

    if (!user) continue;

    // Seed credential in accounts table for Better Auth
    const [credentialAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));

    if (credentialAccount) {
      await db
        .update(accounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(accounts.id, credentialAccount.id));
    } else {
      await db.insert(accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      });
    }

    // Seed facility assignments
    for (const facCode of demo.facilityCodes) {
      const facId = facilityMap.get(facCode);
      if (!facId) continue;

      const [existingAssignment] = await db
        .select()
        .from(facilityAssignments)
        .where(
          and(eq(facilityAssignments.userId, user.id), eq(facilityAssignments.facilityId, facId)),
        );

      if (!existingAssignment) {
        await db.insert(facilityAssignments).values({
          userId: user.id,
          facilityId: facId,
          role: demo.role as "FACILITY_STAFF" | "FACILITY_MANAGER",
          isActive: true,
        });
        console.log(`  -> Assigned ${demo.email} to ${facCode}`);
      } else {
        await db
          .update(facilityAssignments)
          .set({ isActive: true, role: demo.role as "FACILITY_STAFF" | "FACILITY_MANAGER" })
          .where(eq(facilityAssignments.id, existingAssignment.id));
      }
    }
  }

  console.log("✅ Finished seeding all demo users successfully!");
  process.exit(0);
}

seedBetterAuth().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
