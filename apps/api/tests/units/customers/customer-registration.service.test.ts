import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictError, ValidationError } from "../../../src/common/errors/app-error";
import { CustomerRegistrationService } from "../../../src/modules/customers/customer-registration.service";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "New Account Name",
  email: " Guest@Example.com ",
  phone: "+84901234567",
};

const guestCustomer = {
  id: "00000000-0000-0000-0000-000000000002",
  userId: user.id,
  fullName: "Original Guest Name",
  email: "guest@example.com",
  phone: "+84909999999",
};

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findRegistrationIdentity: async () => ({ userExists: false, customerUserId: null }),
    reconcileVerifiedUser: async () => guestCustomer,
    ...overrides,
  } as never;
}

describe("CustomerRegistrationService", () => {
  it("normalizes email and rejects an existing User with sign-in guidance", async () => {
    let lookedUpEmail = "";
    const service = new CustomerRegistrationService(
      repository({
        findRegistrationIdentity: async (email: string) => {
          lookedUpEmail = email;
          return { userExists: true, customerUserId: null };
        },
      }),
    );

    await assert.rejects(
      () => service.assertEmailCanRegister(user.email),
      (error: unknown) =>
        error instanceof ConflictError && /đăng nhập|khôi phục/i.test(error.message),
    );
    assert.equal(lookedUpEmail, "guest@example.com");
  });

  it("rejects a Customer linked to a different User", async () => {
    const service = new CustomerRegistrationService(
      repository({
        findRegistrationIdentity: async () => ({
          userExists: false,
          customerUserId: "00000000-0000-0000-0000-000000000099",
        }),
      }),
    );

    await assert.rejects(() => service.assertEmailCanRegister(user.email), ConflictError);
  });

  it("delegates verified reconciliation without replacing the guest profile", async () => {
    let reconciled: unknown;
    const service = new CustomerRegistrationService(
      repository({
        reconcileVerifiedUser: async (value: typeof user) => {
          reconciled = value;
          return guestCustomer;
        },
      }),
    );

    const result = await service.linkVerifiedUser(user);

    assert.deepEqual(reconciled, {
      ...user,
      email: "guest@example.com",
    });
    assert.equal(result.fullName, "Original Guest Name");
    assert.equal(result.phone, "+84909999999");
  });

  it("requires a phone before creating or linking a Customer", async () => {
    const service = new CustomerRegistrationService(repository());

    await assert.rejects(() => service.linkVerifiedUser({ ...user, phone: null }), ValidationError);
  });
});
