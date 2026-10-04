import type {
  BookingListItem,
  EligibleUnit,
  FacilityStaffMember,
  PhysicalUnitAssignment,
} from "@metastorage/contracts";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { BOOKING_MESSAGES } from "./bookings.messages";
import type { BookingsRepository } from "./bookings.repository";

export class BookingsService {
  constructor(private readonly repository: BookingsRepository) {}

  async verifyQr(qrToken: string) {
    const booking = await this.repository.findByQrToken(qrToken);
    if (!booking) throw new NotFoundError(BOOKING_MESSAGES.invalidQrOrBookingNotFound);
    if (["CANCELLED", "NO_SHOW"].includes(booking.status)) {
      throw new ConflictError(BOOKING_MESSAGES.bookingCannotCheckIn);
    }
    return booking;
  }

  async getFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
    return this.repository.findFacilityStaff(facilityId);
  }

  async getFacilityBookings(facilityId: string, status?: string): Promise<BookingListItem[]> {
    return this.repository.findFacilityBookings(facilityId, status);
  }

  async getBookingById(bookingId: string): Promise<BookingListItem> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError(BOOKING_MESSAGES.bookingDetailsNotFound);
    }
    return booking;
  }

  async getEligibleUnits(bookingId: string): Promise<EligibleUnit[]> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError(BOOKING_MESSAGES.bookingDetailsNotFound);
    }

    return this.repository.findEligibleUnits(
      booking.facilityId,
      booking.unitTypeId,
      booking.id,
      new Date(booking.checkInSlotStart),
      new Date(booking.rentalEndAt),
    );
  }

  async assignPhysicalUnit(
    bookingId: string,
    physicalUnitId: string,
    assignedByUserId: string,
    reason?: string,
  ): Promise<PhysicalUnitAssignment> {
    const result = await this.repository.assignPhysicalUnit(
      bookingId,
      physicalUnitId,
      assignedByUserId,
      reason,
    );

    if ("error" in result) {
      switch (result.error) {
        case "BOOKING_NOT_FOUND":
          throw new NotFoundError(BOOKING_MESSAGES.bookingNotFound);
        case "PHYSICAL_UNIT_NOT_FOUND":
          throw new NotFoundError(BOOKING_MESSAGES.physicalUnitNotFound);
        case "INVALID_BOOKING_STATUS":
          throw new BadRequestError(BOOKING_MESSAGES.invalidBookingStatus(result.currentStatus));
        case "UNIT_TYPE_OR_FACILITY_MISMATCH":
          throw new ValidationError(BOOKING_MESSAGES.physicalUnitDoesNotMatchReservation);
        case "UNIT_STATUS_INVALID":
          throw new BadRequestError(BOOKING_MESSAGES.physicalUnitUnavailable(result.unitStatus));
        case "UNIT_RENTAL_CONFLICT":
          throw new ConflictError(BOOKING_MESSAGES.physicalUnitRentalConflict);
        case "UNIT_ASSIGNMENT_CONFLICT":
          throw new ConflictError(BOOKING_MESSAGES.physicalUnitAssignmentConflict);
        default:
          throw new AppError(BOOKING_MESSAGES.physicalUnitAssignmentFailed, 500);
      }
    }

    return result.assignment;
  }

  async assignStaff(bookingId: string, staffId: string): Promise<BookingListItem> {
    const result = await this.repository.assignStaff(bookingId, staffId);

    if ("error" in result) {
      switch (result.error) {
        case "BOOKING_NOT_FOUND":
          throw new NotFoundError("Không tìm thấy đơn đặt chỗ");
        case "STAFF_NOT_IN_FACILITY":
          throw new BadRequestError(
            "Nhân viên được chọn không thuộc cơ sở này hoặc không có vai trò phù hợp",
          );
        case "STAFF_INACTIVE":
          throw new BadRequestError("Tài khoản nhân viên đang bị vô hiệu hóa (Inactive)");
        case "INVALID_BOOKING_STATUS":
          throw new ConflictError(BOOKING_MESSAGES.bookingCannotCheckIn);
        default:
          throw new AppError("Không thể chỉ định nhân viên phụ trách", 500);
      }
    }

    const updatedBooking = await this.repository.findBookingById(bookingId);
    if (!updatedBooking) {
      throw new NotFoundError("Không tìm thấy đơn đặt chỗ sau khi cập nhật");
    }
    return updatedBooking;
  }

  async getStaffTasks(staffUserId: string, facilityId?: string): Promise<BookingListItem[]> {
    return this.repository.findStaffTasks(staffUserId, facilityId);
  }
}
