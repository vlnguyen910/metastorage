export interface BookingConfirmationEmailInput {
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
}

export interface MailAdapter {
  sendBookingConfirmation(input: BookingConfirmationEmailInput): Promise<{
    providerMessageId: string;
  }>;
}

export class MockMailAdapter implements MailAdapter {
  async sendBookingConfirmation(input: BookingConfirmationEmailInput) {
    console.log(
      `[mock-mail] booking confirmation ${input.bookingCode ?? "unknown"} -> ${input.recipientEmail} (${input.facilityName}, ${input.unitTypeName})`,
    );
    return { providerMessageId: `mock_${input.bookingCode ?? Date.now()}` };
  }
}
