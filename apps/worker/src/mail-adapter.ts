import type { BookingConfirmationEmailInput, MailAdapter } from "./mail-adapter.types";

export type { BookingConfirmationEmailInput, MailAdapter } from "./mail-adapter.types";

export class MockMailAdapter implements MailAdapter {
  async sendBookingConfirmation(input: BookingConfirmationEmailInput) {
    console.log(
      `[mock-mail] booking confirmation ${input.bookingCode ?? "unknown"} -> ${input.recipientEmail} (${input.facilityName}, ${input.unitTypeName}, ${input.qrUrl})`,
    );
    return { providerMessageId: `mock_${input.bookingCode ?? Date.now()}` };
  }
}
