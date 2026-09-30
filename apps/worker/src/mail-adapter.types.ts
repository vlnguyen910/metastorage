export interface BookingConfirmationEmailInput {
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  qrUrl: string;
}

export interface MailAdapter {
  sendBookingConfirmation(input: BookingConfirmationEmailInput): Promise<{
    providerMessageId: string;
  }>;
}
