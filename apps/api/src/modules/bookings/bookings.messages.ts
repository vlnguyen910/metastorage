export const BOOKING_MESSAGES = {
  invalidQrOrBookingNotFound: "QR không hợp lệ hoặc Booking không tồn tại",
  bookingCannotCheckIn: "Booking không thể dùng để check-in",
  bookingDetailsNotFound: "Không tìm thấy thông tin đơn đặt chỗ (Booking)",
  bookingNotFound: "Không tìm thấy đơn đặt chỗ",
  physicalUnitNotFound: "Không tìm thấy ô kho vật lý (Physical Unit)",
  invalidBookingStatus: (status: string) =>
    `Đơn đặt chỗ ở trạng thái '${status}', không thể gán ô kho`,
  physicalUnitDoesNotMatchReservation: "Ô kho vật lý không khớp với cơ sở hoặc loại kho đã đặt",
  physicalUnitUnavailable: (status: string) =>
    `Ô kho vật lý đang ở trạng thái không khả dụng ('${status}')`,
  physicalUnitRentalConflict:
    "Ô kho vật lý hiện đang có hợp đồng thuê khác chồng lấn khoảng thời gian này",
  physicalUnitAssignmentConflict:
    "Ô kho vật lý đã được gán cho một đơn đặt chỗ khác trong cùng kỳ thuê",
  physicalUnitAssignmentFailed: "Không thể gán ô kho vật lý",
  failedToCreateUnitAssignment: "Failed to create unit assignment",
} as const;
