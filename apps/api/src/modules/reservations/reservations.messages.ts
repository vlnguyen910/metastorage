export const RESERVATION_MESSAGES = {
  facilityOrUnitTypeUnavailable: "Không tìm thấy facility hoặc Unit Type khả dụng",
  checkInOutsideAdvanceWindow: "Check-in phải từ hiện tại đến tối đa 30 ngày tới",
  checkInOutsideOperatingHours: "Check-in nằm ngoài giờ hoạt động của facility",
  unitTypeCapacityUnavailable: "Unit Type không còn capacity trong kỳ thuê",
  reservationDraftNotFound: "Không tìm thấy reservation draft",
  failedToCreateDraft: "Failed to create reservation draft",
} as const;
