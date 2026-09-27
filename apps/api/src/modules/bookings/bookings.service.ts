import type { BookingListItem, EligibleUnit, PhysicalUnitAssignment } from "@storex/contracts";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import type { BookingsRepository } from "./bookings.repository";

export class BookingsService {
  constructor(private readonly repository: BookingsRepository) {}

  async getFacilityBookings(facilityId: string, status?: string): Promise<BookingListItem[]> {
    return this.repository.findFacilityBookings(facilityId, status);
  }

  async getBookingById(bookingId: string): Promise<BookingListItem> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError("Không tìm thấy thông tin đơn đặt chỗ (Booking)");
    }
    return booking;
  }

  async getEligibleUnits(bookingId: string): Promise<EligibleUnit[]> {
    const booking = await this.repository.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError("Không tìm thấy thông tin đơn đặt chỗ (Booking)");
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
          throw new NotFoundError("Không tìm thấy đơn đặt chỗ");
        case "PHYSICAL_UNIT_NOT_FOUND":
          throw new NotFoundError("Không tìm thấy ô kho vật lý (Physical Unit)");
        case "INVALID_BOOKING_STATUS":
          throw new BadRequestError(
            `Đơn đặt chỗ ở trạng thái '${result.currentStatus}', không thể gán ô kho`,
          );
        case "UNIT_TYPE_OR_FACILITY_MISMATCH":
          throw new ValidationError("Ô kho vật lý không khớp với cơ sở hoặc loại kho đã đặt");
        case "UNIT_STATUS_INVALID":
          throw new BadRequestError(
            `Ô kho vật lý đang ở trạng thái không khả dụng ('${result.unitStatus}')`,
          );
        case "UNIT_RENTAL_CONFLICT":
          throw new ConflictError(
            "Ô kho vật lý hiện đang có hợp đồng thuê khác chồng lấn khoảng thời gian này",
          );
        case "UNIT_ASSIGNMENT_CONFLICT":
          throw new ConflictError(
            "Ô kho vật lý đã được gán cho một đơn đặt chỗ khác trong cùng kỳ thuê",
          );
        default:
          throw new AppError("Không thể gán ô kho vật lý", 500);
      }
    }

    return result.assignment;
  }
}
