import { randomUUID } from "node:crypto";
import { expo } from "@better-auth/expo";
import { accounts, db, eq, sessions, users, verifications } from "@storex/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { ResendMailer } from "../../common/adapters/mailer/resend.adapter";
import { env } from "../../config/env";
import { CustomerRegistrationRepository } from "../customers/customer-registration.repository";
import { CustomerRegistrationService } from "../customers/customer-registration.service";

const verificationMailer = new ResendMailer({
  apiKey: env.RESEND_API_KEY,
  fromEmail: env.RESEND_FROM_EMAIL,
});
const customerRegistration = new CustomerRegistrationService(
  new CustomerRegistrationRepository(db),
);

async function linkVerifiedCustomer(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.role === "CUSTOMER" && user.emailVerified) {
    await customerRegistration.linkVerifiedUser(user);
  }
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    ...env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
    "storex://",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await verificationMailer.sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl: url,
      });
    },
    afterEmailVerification: async (user) => linkVerifiedCustomer(user.id),
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      role: {
        type: [
          "CUSTOMER",
          "FACILITY_STAFF",
          "FACILITY_MANAGER",
          "BUSINESS_OPERATION_MANAGER",
          "SYSTEM_ADMIN",
        ],
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
      status: {
        type: ["ACTIVE", "INACTIVE"],
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => linkVerifiedCustomer(session.userId),
      },
    },
  },
  plugins: [expo()],
  advanced: {
    cookiePrefix: "storex-auth",
    useSecureCookies: env.NODE_ENV === "production",
    database: {
      generateId: () => randomUUID(),
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
