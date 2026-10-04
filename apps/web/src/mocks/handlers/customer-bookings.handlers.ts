import {
  ApiErrorCode,
  CancelBookingInputSchema,
  type CustomerBooking,
  RescheduleBookingInputSchema,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type { AxiosRequestConfig } from "axios";
import type MockAdapter from "axios-mock-adapter";
import { BOOKING_MESSAGES as M } from "@/features/bookings/bookings.messages";
import { addMonths, currentUser, envelope, errorBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";
import {
  CUSTOMER_BOOKING_INVENTORY,
  CUSTOMER_BOOKING_MOCK_NOW,
  createCustomerBookingSeeds,
} from "../seeds/customer-bookings.seed";
import type { MockDatabase } from "../types";

function actions(booking: CustomerBooking, db: MockDatabase): CustomerBooking {
  const confirmed = booking.status === "CONFIRMED";
  const linked = db.bookings.find((item) => item.id === CUSTOMER_BOOKING_INVENTORY.bookingId);
  const arrived =
    db.checkInVerifications?.some(
      (item) =>
        item.bookingId === CUSTOMER_BOOKING_INVENTORY.bookingId &&
        (item.status === "VERIFIED" || item.status === "CONSUMED"),
    ) ?? false;
  const paid = Boolean(linked?.paidAt);
  const allowed = confirmed && !arrived && paid;
  const tooLate = Date.parse(booking.checkInAt) - Date.parse(CUSTOMER_BOOKING_MOCK_NOW) < 86400000;
  booking.actions = {
    canCancel: allowed,
    canReschedule: allowed && !tooLate && booking.rescheduleCount < 2,
    reasonCodes: [
      ...(!confirmed ? ["INVALID_BOOKING_STATE"] : []),
      ...(arrived ? ["ALREADY_ARRIVED"] : []),
      ...(!paid ? ["PAYMENT_NOT_SUCCEEDED"] : []),
      ...(tooLate ? ["RESCHEDULE_TOO_LATE"] : []),
      ...(booking.rescheduleCount >= 2 ? ["RESCHEDULE_LIMIT"] : []),
    ],
  };
  return booking;
}

export const handleCustomerBookingRequest = (
  config: AxiosRequestConfig,
  operation: "mine" | "get" | "cancel" | "reschedule",
): [number, unknown] => {
  const db = getMockDatabase();
  const user = currentUser(config, db);
  if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, M.unauthorized)];
  if (user.role !== UserRole.STORAGE_CUSTOMER)
    return [403, errorBody(ApiErrorCode.FORBIDDEN, M.forbidden)];
  if (!db.customerBookings) {
    db.customerBookings = createCustomerBookingSeeds();
    saveMockDatabase(db);
  }
  // The deterministic fixture belongs to the seeded customer only.
  const own = user.id === "user-1" ? db.customerBookings : [];
  if (operation === "mine")
    return [
      200,
      envelope(
        own.map((item) => actions(item, db)),
        M.success,
      ),
    ];
  const id = config.url?.match(/\/bookings\/([^/?]+)/)?.[1];
  const booking = own.find((item) => item.id === id);
  if (!booking) return [404, errorBody(ApiErrorCode.BOOKING_NOT_FOUND, M.notFound)];
  if (operation === "get") return [200, envelope(actions(booking, db), M.success)];
  let body: unknown;
  try {
    body = JSON.parse(String(config.data ?? "{}"));
  } catch {
    return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalidInput)];
  }
  const parsed = (
    operation === "cancel" ? CancelBookingInputSchema : RescheduleBookingInputSchema
  ).safeParse(body);
  if (!parsed.success) return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, M.invalidInput)];
  db.customerBookingRequests ??= {};
  const requestKey = `${user.id}:${booking.id}:${parsed.data.idempotencyKey}`;
  const fingerprint = JSON.stringify({ operation, ...parsed.data });
  const prior = db.customerBookingRequests[requestKey];
  if (prior)
    return prior.fingerprint === fingerprint
      ? [200, envelope(prior.result, M.success)]
      : [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.conflict)];
  actions(booking, db);
  if (operation === "cancel" ? !booking.actions.canCancel : !booking.actions.canReschedule)
    return [409, errorBody(ApiErrorCode.RESERVATION_CONFLICT, M.conflict)];
  const previous = booking.checkInAt;
  if (operation === "cancel") {
    booking.status = "CANCELLED";
    booking.refund = {
      status: "SUCCEEDED",
      amount: booking.pricing.rentalFeeAmount,
      forfeitedDepositAmount: booking.pricing.depositAmount,
      currency: booking.pricing.currency,
      simulation: true,
    };
  } else {
    const input = RescheduleBookingInputSchema.parse(body);
    const start = Date.parse(input.checkInAt);
    const now = Date.parse(CUSTOMER_BOOKING_MOCK_NOW);
    if (start < now + 86400000 || start > now + 30 * 86400000)
      return [400, errorBody(ApiErrorCode.INVALID_CHECK_IN, M.dateRange)];
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(start));
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (hour < 6 || hour >= 22 || !Number.isFinite(minute))
      return [400, errorBody(ApiErrorCode.INVALID_CHECK_IN, M.openingHours)];
    const end = addMonths(input.checkInAt, booking.durationMonths);
    const capacity = db.units.filter(
      (u) =>
        u.facilityId === CUSTOMER_BOOKING_INVENTORY.facilityId &&
        u.unitTypeId === CUSTOMER_BOOKING_INVENTORY.unitTypeId &&
        u.status !== StorageUnitStatus.INACTIVE &&
        u.status !== StorageUnitStatus.LOCKED &&
        u.status !== StorageUnitStatus.MAINTENANCE,
    ).length;
    const overlapping = db.bookings.filter(
      (b) =>
        b.id !== CUSTOMER_BOOKING_INVENTORY.bookingId &&
        b.facilityId === CUSTOMER_BOOKING_INVENTORY.facilityId &&
        b.unitTypeId === CUSTOMER_BOOKING_INVENTORY.unitTypeId &&
        (b.status === "CONFIRMED" || b.status === "CHECKED_IN") &&
        Date.parse(b.checkInSlotStart) < Date.parse(end) &&
        Date.parse(b.rentalEndAt) > start,
    ).length;
    if (overlapping >= capacity)
      return [409, errorBody(ApiErrorCode.CAPACITY_UNAVAILABLE, M.capacity)];
    const slotLength = booking.checkInSlotEnd
      ? Date.parse(booking.checkInSlotEnd) - Date.parse(previous)
      : null;
    booking.checkInAt = new Date(start).toISOString();
    booking.checkInSlotEnd =
      slotLength === null ? null : new Date(start + slotLength).toISOString();
    booking.rentalEndAt = end;
    booking.rescheduleCount += 1;
  }
  booking.history.push({
    action: operation === "cancel" ? "CANCELLED" : "RESCHEDULED",
    at: CUSTOMER_BOOKING_MOCK_NOW,
    previousCheckInAt: previous,
    newCheckInAt: operation === "cancel" ? null : booking.checkInAt,
  });
  actions(booking, db);
  const staffBooking = db.bookings.find((item) => item.id === CUSTOMER_BOOKING_INVENTORY.bookingId);
  if (staffBooking) {
    staffBooking.status = booking.status;
    staffBooking.checkInSlotStart = booking.checkInAt;
    staffBooking.checkInSlotEnd = booking.checkInSlotEnd;
    staffBooking.rentalEndAt = booking.rentalEndAt;
  }
  db.customerBookingRequests[requestKey] = { fingerprint, result: structuredClone(booking) };
  saveMockDatabase(db);
  return [200, envelope(booking, M.success)];
};
export function registerCustomerBookingHandlers(mock: MockAdapter) {
  mock.onGet("/bookings/mine").reply((config) => handleCustomerBookingRequest(config, "mine"));
  mock
    .onPost(/\/bookings\/[^/]+\/cancel$/)
    .reply((config) => handleCustomerBookingRequest(config, "cancel"));
  mock
    .onPost(/\/bookings\/[^/]+\/reschedule$/)
    .reply((config) => handleCustomerBookingRequest(config, "reschedule"));
}
