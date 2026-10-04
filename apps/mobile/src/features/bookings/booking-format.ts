import { BOOKING_MESSAGES } from "./booking.messages";

export function formatBookingDate(value: string | null) {
  if (!value) return BOOKING_MESSAGES.unavailableDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return BOOKING_MESSAGES.unavailableDate;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(date);
}

export function formatBookingMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(Number(amount));
}

export function bookingErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }
  }
  return BOOKING_MESSAGES.requestFailed;
}
