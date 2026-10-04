export const FACILITY_MESSAGES = {
  loginRequired: "Bạn cần đăng nhập để thực hiện thao tác này",
  facilityIdRequired: "Mã định danh cơ sở (facilityId) là bắt buộc",
  facilityListAccessDenied: "Bạn không có quyền xem danh sách cơ sở",
  facilityAccessDenied: "Bạn không có quyền truy cập cơ sở này",
  facilityOperationDenied: "Bạn không có quyền thực hiện thao tác này tại cơ sở",
  facilityCodeAlreadyExists: (code: string) => `Cơ sở với mã "${code}" đã tồn tại`,
  facilityNotFound: (id: string) => `Không tìm thấy cơ sở với id "${id}"`,
  userNotFound: (id: string) => `Không tìm thấy người dùng với id "${id}"`,
  inactiveUserAssignment: "Không thể phân công cho tài khoản đang bị vô hiệu hóa",
  assignmentRoleMismatch: "Vai trò phân công phải trùng với vai trò của tài khoản",
  staffAssignmentNotFound: "Không tìm thấy phân công nhân sự tương ứng",
  failedToCreateFacility: "Failed to create facility",
  failedToUpsertAssignment: "Failed to upsert assignment",
  unitNotFound: (id: string) => `Không tìm thấy ô kho với id "${id}"`,
  unitNotInFacility: "Ô kho không thuộc cơ sở này",
  invalidUnitStatusTransition: (from: string, to: string) =>
    `Không thể chuyển trạng thái ô kho từ "${from}" sang "${to}"`,
  unitInUseCannotTransition:
    "Không thể thay đổi trạng thái của ô kho đang có khách thuê hoặc đang gán cho đơn đặt chỗ",
} as const;
