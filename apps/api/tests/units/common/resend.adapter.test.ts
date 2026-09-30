import { describe, expect, it, mock } from "bun:test";
import { ResendMailer } from "../../../src/common/adapters/mailer/resend.adapter";

describe("ResendMailer", () => {
  it("sends a verification email through the Resend API", async () => {
    const fetcher = mock(async () => new Response(null, { status: 200 }));
    const mailer = new ResendMailer({
      apiKey: "re_test_key",
      fromEmail: "metastorage <verify@example.com>",
      fetcher,
    });

    await mailer.sendVerificationEmail({
      to: "customer@example.com",
      name: "A Customer",
      verificationUrl: "https://api.example.com/verify?token=abc",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "metastorage <verify@example.com>",
      to: ["customer@example.com"],
      subject: "Xác minh email metastorage",
    });
    expect(String(init.body)).toContain("A Customer");
  });

  it("escapes user-controlled HTML in the email body", async () => {
    const fetcher = mock(async () => new Response(null, { status: 200 }));
    const mailer = new ResendMailer({
      apiKey: "re_test_key",
      fromEmail: "verify@example.com",
      fetcher,
    });

    await mailer.sendVerificationEmail({
      to: "customer@example.com",
      name: "<img src=x>",
      verificationUrl: "https://api.example.com/verify?a=1&b=2",
    });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("&lt;img src=x&gt;");
    expect(String(init.body)).toContain("a=1&amp;b=2");
  });

  it("fails clearly when delivery credentials are missing", async () => {
    const mailer = new ResendMailer({ fetcher: mock(async () => new Response()) });
    await expect(
      mailer.sendVerificationEmail({
        to: "customer@example.com",
        name: "Customer",
        verificationUrl: "https://api.example.com/verify",
      }),
    ).rejects.toThrow("RESEND_API_KEY and RESEND_FROM_EMAIL");
  });

  it("surfaces provider rejection without leaking request details", async () => {
    const fetcher = mock(async () =>
      Response.json({ message: "domain not verified" }, { status: 403 }),
    );
    const mailer = new ResendMailer({
      apiKey: "re_test_key",
      fromEmail: "verify@example.com",
      fetcher,
    });

    await expect(
      mailer.sendVerificationEmail({
        to: "customer@example.com",
        name: "Customer",
        verificationUrl: "https://api.example.com/verify",
      }),
    ).rejects.toThrow("Resend rejected verification email (403): domain not verified");
  });
});
