import type { Mailer, VerificationEmail } from "./mailer.interface";

interface ResendAdapterOptions {
  apiKey?: string;
  fromEmail?: string;
  fetcher?: typeof fetch;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

export class ResendMailer implements Mailer {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: ResendAdapterOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async sendVerificationEmail({ to, name, verificationUrl }: VerificationEmail): Promise<void> {
    if (!this.options.apiKey || !this.options.fromEmail) {
      throw new Error(
        "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
      );
    }

    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.options.fromEmail,
        to: [to],
        subject: "Xác minh email StoreX",
        html: `<p>Xin chào ${escapeHtml(name)},</p><p>Vui lòng <a href="${escapeAttribute(verificationUrl)}">xác minh email</a> để hoàn tất đăng ký StoreX.</p>`,
      }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as ResendResponse;
      throw new Error(
        `Resend rejected verification email (${response.status}): ${result.message ?? "unknown error"}`,
      );
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
