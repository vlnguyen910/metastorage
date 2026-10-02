import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SepayPaymentGateway } from "../../../src/modules/payments/sepay.gateway";

const gateway = new SepayPaymentGateway({
  apiKey: "test-api-key",
  paymentPrefix: "SX",
  bankName: "Test Bank",
  accountNumber: "123456789",
  accountName: "STOREX TEST",
  publicApiUrl: "https://api.example.test",
});
describe("SepayPaymentGateway", () => {
  it("parses a verified incoming transaction", () => {
    const event = gateway.verifyWebhook(
      { authorization: "Apikey test-api-key" },
      JSON.stringify({
        id: 123,
        code: "SXABC123",
        transferType: "in",
        transferAmount: 1500000,
        referenceCode: "FT123",
      }),
    );

    assert.equal(event.providerEventId, "123");
    assert.equal(event.paymentCode, "SXABC123");
    assert.equal(event.amount, 1500000);
  });

  it("rejects an invalid API key", () => {
    assert.throws(() => gateway.verifyWebhook({ authorization: "Apikey wrong" }, "{}"), {
      name: "UnauthorizedError",
    });
  });

  it("creates transfer instructions without exposing secrets", () => {
    const instructions = gateway.createInstructions({
      paymentCode: "SXABC123",
      amount: "1500000",
      currency: "VND",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    assert.equal(instructions.content, "SXABC123");
    assert.equal("apiKey" in instructions, false);
  });

  it("initializes SePay PG checkout session when merchant credentials exist", () => {
    const pgGateway = new SepayPaymentGateway({
      paymentPrefix: "SX",
      env: "sandbox",
      merchantId: "test_merchant",
      secretKey: "test_secret_key",
      webUrl: "http://localhost:3000",
    });

    const session = pgGateway.createCheckoutSession({
      paymentCode: "SXORDER01",
      amount: 500000,
      currency: "VND",
      description: "Thanh toan don hang SXORDER01",
      draftId: "11111111-1111-1111-1111-111111111111",
      paymentId: "22222222-2222-2222-2222-222222222222",
    });

    assert.ok(session);
    assert.ok(session.checkoutUrl.includes("checkout"));
    assert.equal(session.formFields.order_invoice_number, "SXORDER01");
    assert.equal(session.formFields.order_amount, 500000);
    assert.ok(session.formFields.signature);
  });
});
