import {
  ApiErrorCode,
  type AssignBookingStaffInput,
  type AssignPhysicalUnitInput,
  type CheckInLookupInput,
  type CheckInLookupResult,
  type EligibleUnit,
  PaymentStatus,
  type PhysicalUnitAssignment,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, saveMockDatabase } from "../database";

export function registerBookingHandlers(mock: MockAdapter): void {
  // GET /facilities/:facilityId/bookings
  mock.onGet(/\/facilities\/[^/]+\/bookings/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) {
      return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Chưa đăng nhập")];
    }

    const match = config.url?.match(/\/facilities\/([^/?]+)\/bookings/);
    const facilityId = match?.[1];

    // Return bookings for facility
    const results = (database.bookings ?? []).filter(
      (b) => !facilityId || b.facilityId === facilityId || facilityId === "all",
    );
    return [200, envelope(results)];
  });

  // GET /bookings/assigned-to-me
  mock.onGet("/bookings/assigned-to-me").reply((config) => {
    const database = getMockDatabase();
    let user = currentUser(config, database);
    if (!user) {
      // Fallback in mock mode if token header was pending or session rehydrating
      user = database.users.find((u) => u.role === UserRole.FACILITY_STAFF) ?? null;
    }
    if (!user) {
      return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Chưa đăng nhập")];
    }

    const searchParams = new URL(config.url ?? "", "http://localhost").searchParams;
    const facilityId = config.params?.facilityId || searchParams.get("facilityId");

    const tasks = (database.bookings ?? []).filter(
      (b) =>
        (b.assignedStaff?.id === user?.id || b.assignedStaff?.email === user?.email) &&
        (!facilityId || b.facilityId === facilityId || facilityId === "all"),
    );

    return [200, envelope(tasks)];
  });

  // POST /check-ins/lookup
  mock.onPost("/check-ins/lookup").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) {
      return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Chưa đăng nhập")];
    }

    const input = parseBody<CheckInLookupInput>(config.data);
    const value = input.value.trim().toLowerCase();
    const booking = (database.bookings ?? []).find((candidate) => {
      if (input.type === "BOOKING_CODE") {
        return candidate.bookingCode.toLowerCase() === value;
      }
      return value.includes(candidate.id.toLowerCase());
    });
    if (!booking) {
      return [404, errorBody(ApiErrorCode.BOOKING_NOT_FOUND, "QR hoặc Booking ID không hợp lệ")];
    }

    const graceEndsAt = booking.checkInSlotEnd
      ? new Date(new Date(booking.checkInSlotEnd).getTime() + 2 * 60 * 60 * 1000).toISOString()
      : null;
    const now = Date.now();
    const reasons: CheckInLookupResult["eligibility"]["reasons"] = [];
    if (booking.status !== "CONFIRMED") reasons.push("INVALID_BOOKING_STATUS");
    if (!booking.assignedUnit) reasons.push("UNIT_NOT_ASSIGNED");
    if (!graceEndsAt) reasons.push("CHECKIN_SLOT_NOT_CONFIGURED");
    else if (now < new Date(booking.checkInSlotStart).getTime()) reasons.push("TOO_EARLY");
    else if (now > new Date(graceEndsAt).getTime()) reasons.push("DEADLINE_PASSED");

    const result: CheckInLookupResult = {
      booking: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        facilityId: booking.facilityId,
        facilityName: booking.facilityName,
        unitTypeName: booking.unitTypeName,
        unitTypeSizeLabel: booking.unitTypeSizeLabel,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
        totalAmount: booking.totalAmount,
        requestedMonths: booking.requestedMonths,
        checkInSlotStart: booking.checkInSlotStart,
        checkInSlotEnd: booking.checkInSlotEnd,
        graceEndsAt,
        rentalEndAt: booking.rentalEndAt,
      },
      payment: {
        status: booking.paidAt ? PaymentStatus.SUCCEEDED : null,
        paidAt: booking.paidAt,
        totalAmount: booking.totalAmount,
        rentalFeeAmount: booking.totalAmount,
        depositAmount: 0,
        currency: "VND",
      },
      assignedUnit: booking.assignedUnit ?? null,
      eligibility: { canProceed: reasons.length === 0, reasons },
      verification: null,
    };
    return [200, envelope(result)];
  });

  // POST /check-ins/:bookingId/confirm
  mock.onPost(/\/check-ins\/[^/]+\/confirm$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    const match = config.url?.match(/\/check-ins\/([^/]+)\/confirm/);
    const booking = (database.bookings ?? []).find((candidate) => candidate.id === match?.[1]);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Chưa đăng nhập")];
    if (!booking?.assignedUnit) {
      return [409, errorBody(ApiErrorCode.INVALID_CHECK_IN, "Booking chưa đủ điều kiện check-in")];
    }

    const verification = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      facilityId: booking.facilityId,
      staffId: user.id,
      unitAssignmentId: booking.assignedUnit.id,
      status: "VERIFIED" as const,
      verifiedAt: new Date().toISOString(),
      consumedAt: null,
      invalidatedAt: null,
      invalidatedReason: null,
    };
    const result: CheckInLookupResult = {
      booking: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        facilityId: booking.facilityId,
        facilityName: booking.facilityName,
        unitTypeName: booking.unitTypeName,
        unitTypeSizeLabel: booking.unitTypeSizeLabel,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
        totalAmount: booking.totalAmount,
        requestedMonths: booking.requestedMonths,
        checkInSlotStart: booking.checkInSlotStart,
        checkInSlotEnd: booking.checkInSlotEnd,
        graceEndsAt: booking.checkInSlotEnd
          ? new Date(new Date(booking.checkInSlotEnd).getTime() + 2 * 60 * 60 * 1000).toISOString()
          : null,
        rentalEndAt: booking.rentalEndAt,
      },
      payment: {
        status: booking.paidAt ? PaymentStatus.SUCCEEDED : null,
        paidAt: booking.paidAt,
        totalAmount: booking.totalAmount,
        rentalFeeAmount: booking.totalAmount,
        depositAmount: 0,
        currency: "VND",
      },
      assignedUnit: booking.assignedUnit,
      eligibility: { canProceed: true, reasons: [] },
      verification,
    };
    return [200, envelope(result)];
  });

  // GET /bookings/:id/eligible-units
  mock.onGet(/\/bookings\/[^/]+\/eligible-units/).reply((config) => {
    const database = getMockDatabase();
    const match = config.url?.match(/\/bookings\/([^/?]+)\/eligible-units/);
    const bookingId = match?.[1];

    const booking = (database.bookings ?? []).find((b) => b.id === bookingId);
    if (!booking) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy booking")];
    }

    // Find units in mock database matching facilityId and unitTypeId
    const units = database.units.filter(
      (u) => u.facilityId === booking.facilityId && u.unitTypeId === booking.unitTypeId,
    );
    const eligible: EligibleUnit[] = units.map((u) => ({
      id: u.id,
      facilityId: u.facilityId,
      unitTypeId: u.unitTypeId,
      code: u.code,
      status: u.status,
      isAvailableForPeriod: u.status === StorageUnitStatus.AVAILABLE,
    }));

    return [200, envelope(eligible)];
  });

  // POST /bookings/:id/assign-unit
  mock.onPost(/\/bookings\/[^/]+\/assign-unit/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    const match = config.url?.match(/\/bookings\/([^/?]+)\/assign-unit/);
    const bookingId = match?.[1];
    const body = parseBody<AssignPhysicalUnitInput>(config.data);

    const booking = (database.bookings ?? []).find((b) => b.id === bookingId);
    if (!booking) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy booking")];
    }

    const unit = database.units.find((u) => u.id === body.physicalUnitId);
    if (!unit) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy unit")];
    }

    if (unit.status !== StorageUnitStatus.AVAILABLE) {
      return [400, errorBody(ApiErrorCode.UNIT_UNAVAILABLE, "Ô kho vật lý không khả dụng")];
    }

    const assignment: PhysicalUnitAssignment = {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      physicalUnitId: unit.id,
      physicalUnitCode: unit.code,
      assignedBy: user?.id ?? "user-3",
      assignerName: user?.name ?? "Lê Thu Hà (Facility Manager)",
      status: "ACTIVE",
      assignedAt: new Date().toISOString(),
      endedAt: null,
      reason: body.reason ?? null,
    };

    booking.assignedUnit = assignment;
    saveMockDatabase(database);

    return [200, envelope(assignment)];
  });

  // POST /bookings/:id/assign-staff
  mock.onPost(/\/bookings\/[^/]+\/assign-staff/).reply((config) => {
    const database = getMockDatabase();
    const match = config.url?.match(/\/bookings\/([^/?]+)\/assign-staff/);
    const bookingId = match?.[1];
    const body = parseBody<AssignBookingStaffInput>(config.data);

    const booking = (database.bookings ?? []).find((b) => b.id === bookingId);
    if (!booking) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy booking")];
    }

    const staffUser = database.users.find(
      (u) => u.id === body.staffId && u.role === UserRole.FACILITY_STAFF,
    );
    if (!staffUser) {
      return [400, errorBody(ApiErrorCode.STAFF_NOT_IN_FACILITY, "Nhân viên không hợp lệ")];
    }

    booking.assignedStaff = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      phone: staffUser.phone ?? null,
      role: UserRole.FACILITY_STAFF,
      isActive: true,
    };

    saveMockDatabase(database);

    return [200, envelope(booking)];
  });

  // GET /bookings/:id
  mock.onGet(/\/bookings\/([^/?]+)/).reply((config) => {
    const database = getMockDatabase();
    const match = config.url?.match(/\/bookings\/([^/?]+)/);
    const bookingId = match?.[1];

    const booking = (database.bookings ?? []).find((b) => b.id === bookingId);
    if (!booking) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy booking")];
    }

    return [200, envelope(booking)];
  });
}
