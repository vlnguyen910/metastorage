export const UNIT_TRANSITIONS_MESSAGES = {
  // Section Headers
  sectionTitle: "Quản lý Ô kho Vật lý",
  sectionSubtitle:
    "Theo dõi hiện trạng ô kho và thực hiện chuyển đổi trạng thái vận hành theo quy định.",

  // Table Columns & Details
  colCode: "Mã ô kho",
  colType: "Loại kho",
  colFloorLocation: "Vị trí / Tầng",
  colStatus: "Trạng thái",
  colCurrentBooking: "Đơn đang gán",
  colLastUpdated: "Cập nhật",
  colActions: "Thao tác",

  // Search & Filter
  filterAllStatus: "Tất cả trạng thái",
  filterAllTypes: "Tất cả loại kho",
  searchPlaceholder: "Tìm theo mã kho, vị trí...",
  clearFilters: "Đặt lại bộ lọc",

  // Status Labels
  statusAvailable: "Sẵn sàng (Available)",
  statusReserved: "Đã đặt trước (Reserved)",
  statusOccupied: "Đang sử dụng (Occupied)",
  statusMaintenance: "Đang bảo trì (Maintenance)",
  statusInspection: "Đang kiểm tra (Inspection)",
  statusReturnPending: "Chờ trả kho (Return Pending)",
  statusLocked: "Tạm khóa (Locked)",
  statusInactive: "Ngưng hoạt động (Inactive)",

  // Status Descriptions
  statusAvailableDesc: "Ô kho sạch sẽ, sẵn sàng gán cho khách hàng hoặc chuyển bảo trì/kiểm tra.",
  statusReservedDesc: "Ô kho đã được gán cho đơn đặt chỗ chờ khách check-in.",
  statusOccupiedDesc: "Khách hàng đang cất giữ hàng hóa trong ô kho này.",
  statusMaintenanceDesc: "Ô kho đang được sửa chữa, bảo dưỡng hạ tầng kỹ thuật.",
  statusInspectionDesc: "Ô kho đang được vệ sinh, kiểm tra hiện trạng trước khi bàn giao.",
  statusReturnPendingDesc: "Khách đã hoàn tất trả phòng, chờ nhân viên kiểm tra nghiệm thu.",
  statusLockedDesc: "Ô kho bị khóa do sự cố hoặc tranh chấp, cần kiểm tra để mở lại.",
  statusInactiveDesc: "Ô kho tạm thời không phục vụ kinh doanh.",

  // Action Labels
  actionChangeStatus: "Chuyển trạng thái",
  actionCancel: "Hủy bỏ",
  actionConfirmTransition: "Xác nhận chuyển đổi",
  actionProcessing: "Đang cập nhật...",

  // Modal Dialog
  modalTitle: "Chuyển đổi trạng thái ô kho",
  modalSubtitle: "Chọn trạng thái mới phù hợp với quy trình vận hành cơ sở.",
  modalCurrentStatusLabel: "Trạng thái hiện tại:",
  modalTargetStatusLabel: "Trạng thái tiếp theo cho phép:",
  modalNotesLabel: "Ghi chú lý do chuyển đổi (tùy chọn):",
  modalNotesPlaceholder: "Nhập lý do hoặc thông tin bảo trì, kiểm tra nếu có...",
  modalNoTransitionsAllowed:
    "Ô kho này đang trong trạng thái cố định hoặc đang có khách sử dụng, không thể chuyển đổi trạng thái thủ công.",
  modalInUseWarning:
    "Ô kho đang có đơn đặt chỗ hoặc đang được thuê. Không thể đổi trạng thái thủ công ngoài quy trình check-in/check-out.",

  // Feedback Toasts / Alerts
  updateSuccess: (code: string, newStatus: string) =>
    `Đã cập nhật trạng thái ô kho ${code} thành "${newStatus}" thành công.`,
  updateError: "Không thể cập nhật trạng thái ô kho. Vui lòng thử lại.",
  loadUnitsError: "Không thể tải danh sách ô kho của cơ sở. Vui lòng thử lại.",

  // Empty State
  emptyTitle: "Không tìm thấy ô kho nào",
  emptyDesc: "Không có ô kho nào phù hợp với bộ lọc hiện tại của cơ sở này.",
  noBookingAssigned: "Chưa gán đơn",
  noLocation: "Chưa cập nhật vị trí",
} as const;
