import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Database } from "@metastorage/database";
import { ConflictError } from "../../../src/common/errors/app-error";
import { CustomerRegistrationRepository } from "../../../src/modules/customers/customer-registration.repository";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Verified Name",
  email: "guest@example.com",
  phone: "+84901234567",
};

const guestCustomer = {
  id: "00000000-0000-0000-0000-000000000002",
  userId: null,
  fullName: "Original Guest Name",
  email: "Guest@Example.com",
  phone: "+84909999999",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
type TestCustomer = Omit<typeof guestCustomer, "userId"> & { userId: string | null };

function database(options: {
  selected?: TestCustomer[];
  inserted?: TestCustomer[];
  reread?: TestCustomer[];
  updated?: TestCustomer[];
}) {
  const calls: Array<{ method: string; value?: unknown }> = [];
  let selectCount = 0;
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          for: async (lock: string) => {
            calls.push({ method: "for", value: lock });
            selectCount += 1;
            return selectCount === 1 ? (options.selected ?? []) : (options.reread ?? []);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (value: unknown) => {
        calls.push({ method: "insert", value });
        return {
          onConflictDoNothing: () => ({ returning: async () => options.inserted ?? [] }),
        };
      },
    }),
    update: () => ({
      set: (value: unknown) => {
        calls.push({ method: "update", value });
        return { where: () => ({ returning: async () => options.updated ?? [] }) };
      },
    }),
  };
  const db = {
    transaction: async (callback: (transaction: typeof tx) => unknown) => {
      calls.push({ method: "transaction" });
      return callback(tx);
    },
  } as unknown as Database;
  return { db, calls };
}

describe("CustomerRegistrationRepository.reconcileVerifiedUser", () => {
  it("locks and links an existing guest without changing its profile fields", async () => {
    const linked = { ...guestCustomer, userId: user.id, updatedAt: new Date() };
    const { db, calls } = database({ selected: [guestCustomer], updated: [linked] });
    const repository = new CustomerRegistrationRepository(db);

    const result = await repository.reconcileVerifiedUser(user);

    assert.equal(result.userId, user.id);
    assert.equal(result.fullName, guestCustomer.fullName);
    assert.equal(result.phone, guestCustomer.phone);
    assert.deepEqual(
      calls.filter((call) => call.method === "for").map((call) => call.value),
      ["update"],
    );
    const updateValues = calls.find((call) => call.method === "update")?.value as Record<
      string,
      unknown
    >;
    assert.equal(updateValues.userId, user.id);
    assert.ok(updateValues.updatedAt instanceof Date);
    assert.equal("fullName" in updateValues, false);
    assert.equal("email" in updateValues, false);
    assert.equal("phone" in updateValues, false);
    assert.equal(
      calls.some((call) => call.method === "insert"),
      false,
    );
  });

  it("creates a Customer from verified account details when no guest record exists", async () => {
    const created = {
      ...guestCustomer,
      userId: user.id,
      fullName: user.name,
      email: user.email,
      phone: user.phone,
    };
    const { db, calls } = database({ inserted: [created] });
    const repository = new CustomerRegistrationRepository(db);

    const result = await repository.reconcileVerifiedUser(user);

    assert.deepEqual(result, created);
    const insertedValues = calls.find((call) => call.method === "insert")?.value;
    assert.deepEqual(insertedValues, {
      userId: user.id,
      fullName: user.name,
      email: user.email,
      phone: user.phone,
    });
  });

  it("returns the existing link on an idempotent retry", async () => {
    const linked = { ...guestCustomer, userId: user.id };
    const { db, calls } = database({ selected: [linked] });
    const repository = new CustomerRegistrationRepository(db);

    const result = await repository.reconcileVerifiedUser(user);

    assert.equal(result.userId, user.id);
    assert.equal(
      calls.some((call) => call.method === "update"),
      false,
    );
  });

  it("rejects a concurrent link owned by a different User", async () => {
    const linkedElsewhere = {
      ...guestCustomer,
      userId: "00000000-0000-0000-0000-000000000099",
    };
    const { db } = database({ selected: [], inserted: [], reread: [linkedElsewhere] });
    const repository = new CustomerRegistrationRepository(db);

    await assert.rejects(() => repository.reconcileVerifiedUser(user), ConflictError);
  });
});
