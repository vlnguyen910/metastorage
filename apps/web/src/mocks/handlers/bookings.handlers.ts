import {
  ApiErrorCode,
  type AssignPhysicalUnitInput,
  type BookingListItem,
  type CheckInLookupInput,
  type CheckInLookupResult,
  type EligibleUnit,
  PaymentStatus,
  type PhysicalUnitAssignment,
  StorageUnitStatus,
} from "@storex/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase } from "../database";

// In-memory mock storage for bookings & assignments in mock mode
const mockBookings: BookingListItem[] = [
  {
    id: "b0000000-0000-0000-0000-000000000001",
    bookingCode: "BK-2026-0001",
    facilityId: "fac-hcm-central",
    facilityName: "storeX Sài Gòn Central",
    unitTypeId: "00000000-0000-0000-0001-000000000001",
    unitTypeName: "Kho tiêu chuẩn (2 m²)",
    unitTypeSizeLabel: "2 m²",
    customerId: "user-1",
    contactName: "Lê Thị Mai Linh",
    contactEmail: "linh.le@example.com",
    contactPhone: "0912345678",
    checkInSlotStart: new Date(Date.now() + 2 * 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(),
    rentalEndAt: new Date(Date.now() + 32 * 86400000).toISOString(),
    requestedMonths: 1,
    totalAmount: 900000,
    status: "CONFIRMED",
    paidAt: new Date(Date.now() - 3600000).toISOString(),
    assignedUnit: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    bookingCode: "BK-2026-0002",
    facilityId: "fac-hcm-central",
    facilityName: "storeX Sài Gòn Central",
    unitTypeId: "00000000-0000-0000-0001-000000000003",
    unitTypeName: "Kho tiêu chuẩn (4 m²)",
    unitTypeSizeLabel: "4 m²",
    customerId: "c0000000-0000-0000-0000-000000000002",
    contactName: "Trần Minh Đức",
    contactEmail: "duc.tran@example.com",
    contactPhone: "0988776655",
    checkInSlotStart: new Date(Date.now() + 3 * 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 3 * 86400000 + 7200000).toISOString(),
    rentalEndAt: new Date(Date.now() + 93 * 86400000).toISOString(),
    requestedMonths: 3,
    totalAmount: 4500000,
    status: "CONFIRMED",
    paidAt: new Date(Date.now() - 14400000).toISOString(),
    assignedUnit: null,
    createdAt: new Date(Date.now() - 28800000).toISOString(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    bookingCode: "BK-2026-0003",
    facilityId: "fac-hcm-central",
    facilityName: "storeX Sài Gòn Central",
    unitTypeId: "00000000-0000-0000-0001-000000000005",
    unitTypeName: "Kho tiêu chuẩn (6 m²)",
    unitTypeSizeLabel: "6 m²",
    customerId: "c0000000-0000-0000-0000-000000000003",
    contactName: "Công ty SmartLog (Anh Tuấn)",
    contactEmail: "contact@smartlog.vn",
    contactPhone: "0903112233",
    checkInSlotStart: new Date(Date.now() + 1 * 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 1 * 86400000 + 7200000).toISOString(),
    rentalEndAt: new Date(Date.now() + 180 * 86400000).toISOString(),
    requestedMonths: 6,
    totalAmount: 12600000,
    status: "CONFIRMED",
    paidAt: new Date(Date.now() - 86400000).toISOString(),
    assignedUnit: {
      id: "asgn-00000000-0000-0000-0000-000000000003",
      bookingId: "b0000000-0000-0000-0000-000000000003",
      physicalUnitId: "hcm-01-unit-5",
      physicalUnitCode: "HCM-01-005",
      assignedBy: "user-3",
      assignerName: "Lê Thu Hà (Facility Manager)",
      status: "ACTIVE",
      assignedAt: new Date(Date.now() - 43200000).toISOString(),
      endedAt: null,
      reason: "Đã gán ô kho tầng trệt gần cửa ra vào theo yêu cầu của khách",
    },
    createdAt: new Date(Date.now() - 90000000).toISOString(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000004",
    bookingCode: "BK-2026-0004",
    facilityId: "fac-hcm-central",
    facilityName: "storeX Sài Gòn Central",
    unitTypeId: "00000000-0000-0000-0001-000000000001",
    unitTypeName: "Kho tiêu chuẩn (2 m²)",
    unitTypeSizeLabel: "2 m²",
    customerId: "c0000000-0000-0000-0000-000000000004",
    contactName: "Hoàng Văn Thái",
    contactEmail: "thai.hoang@example.com",
    contactPhone: "0977554433",
    checkInSlotStart: new Date(Date.now() - 1 * 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() - 1 * 86400000 + 7200000).toISOString(),
    rentalEndAt: new Date(Date.now() + 59 * 86400000).toISOString(),
    requestedMonths: 2,
    totalAmount: 1800000,
    status: "CHECKED_IN",
    paidAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    assignedUnit: {
      id: "asgn-00000000-0000-0000-0000-000000000004",
      bookingId: "b0000000-0000-0000-0000-000000000004",
      physicalUnitId: "hcm-01-unit-2",
      physicalUnitCode: "HCM-01-002",
      assignedBy: "user-3",
      assignerName: "Lê Thu Hà (Facility Manager)",
      status: "ACTIVE",
      assignedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      endedAt: null,
      reason: null,
    },
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000005",
    bookingCode: "BK-2026-0005",
    facilityId: "fac-hcm-central",
    facilityName: "storeX Sài Gòn Central",
    unitTypeId: "00000000-0000-0000-0001-000000000007",
    unitTypeName: "Kho kiểm soát ẩm (4 m²)",
    unitTypeSizeLabel: "4 m²",
    customerId: "c0000000-0000-0000-0000-000000000005",
    contactName: "Nguyễn Bích Ngọc",
    contactEmail: "ngoc.nguyen@example.com",
    contactPhone: "0933221100",
    checkInSlotStart: new Date(Date.now() + 5 * 86400000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
    rentalEndAt: new Date(Date.now() + 35 * 86400000).toISOString(),
    requestedMonths: 1,
    totalAmount: 1900000,
    status: "CONFIRMED",
    paidAt: new Date(Date.now() - 5000000).toISOString(),
    assignedUnit: null,
    createdAt: new Date(Date.now() - 6000000).toISOString(),
  },
];

export function registerBookingHandlers(mock: MockAdapter): void {
  // GET /facilities/:facilityId/bookings
  mock.onGet(/\/facilities\/[^/]+\/bookings$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) {
      return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Chưa đăng nhập")];
    }

    const match = config.url?.match(/\/facilities\/([^/]+)\/bookings/);
    const facilityId = match?.[1];

    // Return bookings for facility
    const results = mockBookings.filter(
      (b) => !facilityId || b.facilityId === facilityId || facilityId === "all",
    );
    return [200, envelope(results)];
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
    const booking = mockBookings.find((candidate) => {
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
        customerId: booking.customerId,
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
    const booking = mockBookings.find((candidate) => candidate.id === match?.[1]);
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
        customerId: booking.customerId,
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
  mock.onGet(/\/bookings\/[^/]+\/eligible-units$/).reply((config) => {
    const database = getMockDatabase();
    const match = config.url?.match(/\/bookings\/([^/]+)\/eligible-units/);
    const bookingId = match?.[1];

    const booking = mockBookings.find((b) => b.id === bookingId);
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
  mock.onPost(/\/bookings\/[^/]+\/assign-unit$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    const match = config.url?.match(/\/bookings\/([^/]+)\/assign-unit/);
    const bookingId = match?.[1];
    const body = parseBody<AssignPhysicalUnitInput>(config.data);

    const booking = mockBookings.find((b) => b.id === bookingId);
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

    return [200, envelope(assignment)];
  });

  // GET /bookings/:id
  mock.onGet(/\/bookings\/[^/]+$/).reply((config) => {
    const match = config.url?.match(/\/bookings\/([^/]+)/);
    const bookingId = match?.[1];

    const booking = mockBookings.find((b) => b.id === bookingId);
    if (!booking) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy booking")];
    }

    return [200, envelope(booking)];
  });
}
