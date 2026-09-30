export const AUTH_MESSAGES = {
  customerSignupEmailDeliveryUnavailable: "Customer signup email delivery is not configured.",
  noTrustedWebOriginForEmailVerification:
    "No trusted web origin is configured for email verification.",
  customerSignupVerificationEmailSent:
    "Đã gửi liên kết xác minh. Vui lòng kiểm tra email trước khi đăng nhập.",
  customerSignupMustUseCustomerEndpoint: "Customer signup must use the customer-sign-up endpoint.",
  accountDisabled: "Tài khoản này đã bị vô hiệu hóa",
  permissionDenied: "Bạn không có quyền thực hiện thao tác này",
  loginRequired: "Bạn cần đăng nhập để thực hiện thao tác này",
} as const;
