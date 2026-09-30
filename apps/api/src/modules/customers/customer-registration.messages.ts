export const CUSTOMER_REGISTRATION_MESSAGES = {
  accountRecovery:
    "Email đã có tài khoản hoặc hồ sơ Customer đã liên kết. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
  accountLinkedToAnotherUser:
    "Email đã liên kết với tài khoản khác. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
  customerNameAndPhoneRequired: "Tên và số điện thoại cần có để tạo hồ sơ Customer.",
  concurrentReconciliationFailed: "Customer reconciliation failed after a concurrent insert",
} as const;
