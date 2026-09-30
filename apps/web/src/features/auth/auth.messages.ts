export const AUTH_MESSAGES = {
  invalidEmail: "Email chưa đúng định dạng",
  passwordTooShort: "Mật khẩu cần ít nhất 8 ký tự",
  loginEmailNotVerified:
    "Email chưa xác minh. Nếu thông tin đăng nhập đúng, metastorage đã gửi lại liên kết xác minh.",
  loginFailed: "Không thể đăng nhập",
  loginWelcome: (name: string) => `Chào mừng ${name}`,
  registrationFailed: "Chưa thể tạo tài khoản. Vui lòng thử lại sau.",
  forgotPasswordRequestAccepted:
    "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
} as const;
