export const LIFECYCLE_MESSAGES = {
  NOT_FOUND: "Không tìm thấy Booking",
  INVALID_BOOKING_STATE: "Booking không còn ở trạng thái cho phép thao tác",
  PAYMENT_NOT_SUCCEEDED: "Booking chưa được thanh toán thành công",
  ALREADY_ARRIVED: "Khách đã check-in, không thể hủy hoặc đổi lịch Booking",
  RENTAL_ACTIVE: "Kho đang được thuê; vui lòng sử dụng quy trình trả kho",
  RESCHEDULE_TOO_LATE: "Lịch cũ và mới phải cách hiện tại ít nhất 24 giờ",
  RESCHEDULE_LIMIT: "Booking đã sử dụng hết hai lần đổi lịch",
  CHECK_IN_TOO_FAR: "Lịch mới không được vượt quá 30 ngày",
  CHECK_IN_OUTSIDE_HOURS: "Giờ check-in nằm ngoài giờ hoạt động",
  CONTEXT_INACTIVE: "Cơ sở hoặc loại kho không còn hoạt động",
  CAPACITY_UNAVAILABLE: "Không còn chỗ trong toàn bộ kỳ thuê mới",
  ALLOCATION_MISSING: "Booking thiếu capacity reservation hợp lệ",
  IDEMPOTENCY_KEY_REUSED: "Mã yêu cầu đã được sử dụng cho thao tác khác",
  NO_SHOW_NOT_DUE: "Booking chưa quá hạn no-show",
  assignmentEnded: "Booking đã hủy, no-show hoặc thay đổi lịch",
} as const;
export class BookingLifecycleError extends Error {
  constructor(
    public readonly code: keyof typeof LIFECYCLE_MESSAGES,
    public readonly statusCode = 409,
  ) {
    super(LIFECYCLE_MESSAGES[code]);
  }
}
