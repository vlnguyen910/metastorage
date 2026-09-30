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
import type { BookingsRepository } from "./bookings.repository";

export class BookingsService {
  constructor(private readonly repository: BookingsRepository) {}

  async verifyQr(qrToken: string) {
    const booking = await this.repository.findByQrToken(qrToken);
    if (!booking) throw new NotFoundError("QR không hợp lệ hoặc Booking không tồn tại");
    if (["CANCELLED", "NO_SHOW"].includes(booking.status)) {
      throw new ConflictError("Booking không thể dùng để check-in");
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
