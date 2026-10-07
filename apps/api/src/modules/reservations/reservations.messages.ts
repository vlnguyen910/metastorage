export const RESERVATION_MESSAGES = {
  facilityOrUnitTypeUnavailable: "Không tìm thấy facility hoặc Unit Type khả dụng",
  checkInInPast: "Ngày và giờ nhận kho phải sau thời điểm hiện tại (giờ Việt Nam).",
  checkInOutsideSlots: "Giờ nhận kho phải nằm trong một ca nhận kho có sẵn.",
  checkInOutsideOperatingHours: (open: string, close: string) =>
    `Giờ nhận kho phải từ ${open.slice(0, 5)} đến ${close.slice(0, 5)} (giờ Việt Nam) tại chi nhánh này.`,
  unitTypeCapacityUnavailable: "Unit Type không còn capacity trong kỳ thuê",
  reservationDraftNotFound: "Không tìm thấy reservation draft",
  failedToCreateDraft: "Failed to create reservation draft",
} as const;
