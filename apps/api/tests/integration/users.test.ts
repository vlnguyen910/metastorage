import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  accounts,
  type Database,
  type NewAccount,
  type NewUser,
  type User,
  users,
} from "@metastorage/database";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import Fastify, { type FastifyInstance } from "fastify";

const password = "business-password-123";
const customerId = randomUUID();
const adminId = randomUUID();
const adminCookie = `mock-session=${adminId}`;
const customerCookie = `mock-session=${customerId}`;
const records = new Map<string, User>();
const credentials = new Map<string, string>();
let app: FastifyInstance;
let insertFailure: unknown;

// Exercise the real repository's create/error path using a transaction double, never a DB connection.
async function mockTransaction(run: Parameters<Database["transaction"]>[0]) {
  let pendingUser: User | undefined;
  let pendingCredential: NewAccount | undefined;
  const tx = {
    insert(table: unknown) {
      if (table === users) {
        return {
          values: (data: NewUser) => ({
            returning: async () => {
              expect(data).not.toHaveProperty("id");
              expect(data).not.toHaveProperty("createdAt");
              expect(data).not.toHaveProperty("updatedAt");
              if (insertFailure) throw insertFailure;
              if (data.phone && [...records.values()].some((user) => user.phone === data.phone)) {
                throw new Error("Mock PostgreSQL constraint error", {
                  cause: { code: "23505", constraint_name: "users_phone_unique" },
                });
              }
              pendingUser = userFixture(data);
              return [pendingUser];
            },
          }),
        };
      }
      if (table === accounts) {
        return {
          values: async (data: NewAccount) => {
            expect(data.id).toEqual(expect.any(String));
            expect(data.providerId).toBe("credential");
            expect(data.userId).toBe(pendingUser?.id);
            expect(data.accountId).toBe(pendingUser?.id);
            pendingCredential = data;
          },
        };
      }
      throw new Error("Unexpected mock table");
    },
  };
  const result = await run(tx as unknown as Parameters<typeof run>[0]);
  if (pendingUser && pendingCredential) {
    records.set(pendingUser.id, pendingUser);
    credentials.set(pendingUser.id, pendingCredential.password as string);
  }
  return result;
}

function userFixture(data: NewUser): User {
  return {
    id: data.id ?? randomUUID(),
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    emailVerified: data.emailVerified ?? false,
    image: data.image ?? null,
    passwordHash: null,
    role: data.role ?? null,
    status: data.status ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Keep route guards real, replacing only session lookup and password-provider context.
mock.module("../../src/modules/auth/auth", () => ({
  auth: {
    $context: Promise.resolve({ password: { hash: hashPassword } }),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get("cookie")?.match(/mock-session=([^;]+)/)?.[1];
        const user = id ? records.get(id) : undefined;
        return user ? { user, session: { id: `session-${user.id}`, userId: user.id } } : null;
      },
    },
  },
}));

async function createUser(email: string, role = "FACILITY_STAFF", extra = {}) {
  return app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie: adminCookie },
    payload: { name: "Business User", email, password, role, ...extra },
  });
}

describe("user route/service integration with mocked persistence and sessions", () => {
  beforeAll(async () => {
    const { UsersRepository } = await import("../../src/modules/users/users.repository");
    spyOn(UsersRepository.prototype, "findById").mockImplementation(async (id) => records.get(id));
    spyOn(UsersRepository.prototype, "findByEmail").mockImplementation(async (email) =>
      [...records.values()].find((user) => user.email.trim().toLowerCase() === email),
    );
    spyOn(UsersRepository.prototype, "list").mockImplementation(async (limit, offset) =>
      [...records.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .slice(offset, offset + limit),
    );
    spyOn(UsersRepository.prototype, "update").mockImplementation(async (id, data) => {
      const existing = records.get(id);
      if (!existing) return undefined;
      const user = { ...existing, ...data, updatedAt: new Date() };
      records.set(id, user);
      return user;
    });
    const { serializerCompiler, validatorCompiler } = await import("fastify-type-provider-zod");
    const { setupErrorHandler } = await import("../../src/common/errors/error-handler");
    const { authPlugin } = await import("../../src/modules/auth/auth.guard");
    const { usersRoutes } = await import("../../src/modules/users/users.routes");
    app = Fastify();
    app.decorate(
      "db",
      new Proxy({} as Database, {
        get(_target, property) {
          if (property === "getter" || property === "setter") return undefined;
          if (property === "transaction") return mockTransaction;
          throw new Error("Integration tests must not access a database");
        },
      }),
    );
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setupErrorHandler(app);
    app.register(authPlugin);
    app.register(usersRoutes, { prefix: "/api/users" });
    await app.ready();
  });

  beforeEach(() => {
    insertFailure = undefined;
    records.clear();
    credentials.clear();
    records.set(
      adminId,
      userFixture({
        id: adminId,
        name: "Admin",
        email: "admin@example.test",
        role: "SYSTEM_ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      }),
    );
    records.set(
      customerId,
      userFixture({
        id: customerId,
        name: "Customer",
        email: "customer@example.test",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
      }),
    );
  });

  afterAll(async () => {
    await app?.close();
    mock.restore();
  });

  it.each(["FACILITY_STAFF", "FACILITY_MANAGER", "BUSINESS_OPERATION_MANAGER"])(
    "creates a verified %s user and sends a compatible password hash to persistence",
    async (role) => {
      const email = `${role.toLowerCase()}@example.test`;
      const response = await createUser(email.toUpperCase(), role);
      expect(response.statusCode).toBe(201);
      const user = response.json().data;
      expect(user.email).toBe(email);
      expect(user.role).toBe(role);
      expect(user.status).toBe("ACTIVE");
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("passwordHash");
      expect(records.get(user.id)?.emailVerified).toBe(true);
      const hash = credentials.get(user.id);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(await verifyPassword({ hash: hash as string, password })).toBe(true);
    },
  );

  it.each(["CUSTOMER", "SYSTEM_ADMIN"])("rejects creating %s", async (role) => {
    expect((await createUser(`rejected-${role}@example.test`, role)).statusCode).toBe(400);
    expect(records.size).toBe(2);
  });

  it("lets the shared creation service preserve fields chosen by another workflow", async () => {
    const { UsersRepository } = await import("../../src/modules/users/users.repository");
    const { UsersService } = await import("../../src/modules/users/users.service");
    const { AuthService } = await import("../../src/modules/auth/auth.service");
    const service = new UsersService(new UsersRepository(app.db), new AuthService());
    const user = await service.createUser({
      name: "Customer Workflow",
      email: "other-workflow@example.test",
      phone: "+84909999999",
      image: "https://example.test/avatar.png",
      password,
      role: "CUSTOMER",
      status: "INACTIVE",
      emailVerified: false,
    });
    expect(records.get(user.id)).toMatchObject({
      name: "Customer Workflow",
      phone: "+84909999999",
      image: "https://example.test/avatar.png",
      role: "CUSTOMER",
      status: "INACTIVE",
      emailVerified: false,
    });
    expect(await verifyPassword({ hash: credentials.get(user.id) as string, password })).toBe(true);
  });

  it("rejects privilege fields and invalid input", async () => {
    expect((await createUser("invalid")).statusCode).toBe(400);
    expect(
      (await createUser("extra@example.test", "FACILITY_STAFF", { emailVerified: true }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createUser("status-input@example.test", "FACILITY_STAFF", { status: "INACTIVE" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createUser("id-input@example.test", "FACILITY_STAFF", { id: randomUUID() }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createUser("short@example.test", "FACILITY_STAFF", { password: "short" })).statusCode,
    ).toBe(400);
    expect(records.size).toBe(2);
  });

  it("handles normalized email conflicts and mocked phone constraint errors", async () => {
    expect(
      (await createUser("duplicate@example.test", "FACILITY_STAFF", { phone: "+84901234567" }))
        .statusCode,
    ).toBe(201);
    expect((await createUser(" DUPLICATE@EXAMPLE.TEST ")).statusCode).toBe(409);
    expect(
      (await createUser("other@example.test", "FACILITY_STAFF", { phone: "+84901234567" }))
        .statusCode,
    ).toBe(409);
    expect(records.size).toBe(3);
  });

  it.each(["users_email_unique", "users_phone_unique"])(
    "maps a mocked driver %s error through the real repository to HTTP 409",
    async (constraint) => {
      insertFailure = { code: "23505", constraint_name: constraint };
      expect((await createUser("driver-error@example.test")).statusCode).toBe(409);
      expect(records.size).toBe(2);
    },
  );

  it("propagates an unrecognized database failure to the common error handler", async () => {
    insertFailure = new Error("Mock database connection failure");
    const response = await createUser("unexpected-error@example.test");
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(records.size).toBe(2);
  });

  it("lists all users including customers and returns detail only to admin", async () => {
    const list = await app.inject({
      url: "/api/users?limit=100",
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((user: { id: string }) => user.id === customerId)).toBe(true);
    const detail = await app.inject({
      url: `/api/users/${customerId}`,
      headers: { cookie: adminCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.role).toBe("CUSTOMER");
    expect(detail.json().data).not.toHaveProperty("passwordHash");
  });

  it("rejects unauthenticated and customer access to admin endpoints", async () => {
    for (const request of [
      { method: "GET", url: "/api/users" },
      { method: "GET", url: `/api/users/${adminId}` },
      {
        method: "POST",
        url: "/api/users",
        payload: { name: "User", email: "denied@example.test", password, role: "FACILITY_STAFF" },
      },
      { method: "PATCH", url: `/api/users/${customerId}/status`, payload: { status: "INACTIVE" } },
    ] as const) {
      expect((await app.inject(request)).statusCode).toBe(401);
      expect(
        (await app.inject({ ...request, headers: { cookie: customerCookie } })).statusCode,
      ).toBe(403);
    }
    expect(records.size).toBe(2);
  });

  it("updates status and enforces it in guards for an existing mocked session", async () => {
    const created = await createUser("status@example.test");
    const id = created.json().data.id;
    const cookie = `mock-session=${id}`;
    for (const [status, expectedProfileStatus] of [
      ["INACTIVE", 403],
      ["ACTIVE", 200],
    ] as const) {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${id}/status`,
        headers: { cookie: adminCookie },
        payload: { status },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe(status);
      expect(records.get(id)?.status).toBe(status);
      expect(records.get(id)?.role).toBe("FACILITY_STAFF");
      expect((await app.inject({ url: "/api/users/me", headers: { cookie } })).statusCode).toBe(
        expectedProfileStatus,
      );
    }
  });

  it("protects the sole admin and prevents promotion to admin", async () => {
    for (const [id, suffix, payload] of [
      [adminId, "status", { status: "INACTIVE" }],
      [adminId, "role", { role: "FACILITY_STAFF" }],
      [customerId, "role", { role: "SYSTEM_ADMIN" }],
    ] as const) {
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: `/api/users/${id}/${suffix}`,
            headers: { cookie: adminCookie },
            payload,
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(records.get(adminId)?.role).toBe("SYSTEM_ADMIN");
    expect(records.get(adminId)?.status).toBe("ACTIVE");
  });

  it("returns not found and validates status/ID inputs", async () => {
    const missingId = randomUUID();
    expect(
      (await app.inject({ url: `/api/users/${missingId}`, headers: { cookie: adminCookie } }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/users/${missingId}/status`,
          headers: { cookie: adminCookie },
          payload: { status: "INACTIVE" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/users/${customerId}/status`,
          headers: { cookie: adminCookie },
          payload: { status: "OTHER" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/api/users/not-a-uuid", headers: { cookie: adminCookie } }))
        .statusCode,
    ).toBe(400);
  });
});
