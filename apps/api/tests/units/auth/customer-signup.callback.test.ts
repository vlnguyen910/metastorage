import { describe, expect, it } from "bun:test";
import { getCustomerSignupCallbackUrl } from "../../../src/modules/auth/customer-signup.callback";

describe("customer signup verification callback", () => {
  it("uses a fixed app deep link for mobile", () => {
    expect(getCustomerSignupCallbackUrl("mobile", ["https://store.example.com"])).toBe(
      "storex://auth/verified",
    );
  });

  it("uses only an HTTP(S) origin from the trusted origins for web", () => {
    expect(
      getCustomerSignupCallbackUrl("web", ["storex://auth", "https://store.example.com"]),
    ).toBe("https://store.example.com/verify-email");
  });

  it("does not accept a callback URL from the request or invent an untrusted web origin", () => {
    expect(getCustomerSignupCallbackUrl("web", ["storex://auth"])).toBeUndefined();
  });
});
