import { ConflictError, ValidationError } from "../../common/errors/app-error";
import type {
  CustomerRegistrationRepository,
  VerifiedCustomerRegistrationUser,
} from "./customer-registration.repository";

export interface VerifiedCustomerUserInput {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

const accountRecoveryMessage =
  "Email đã có tài khoản hoặc hồ sơ Customer đã liên kết. Vui lòng đăng nhập hoặc khôi phục mật khẩu.";

export class CustomerRegistrationService {
  constructor(private readonly repository: CustomerRegistrationRepository) {}

  async assertEmailCanRegister(email: string): Promise<void> {
    const identity = await this.repository.findRegistrationIdentity(normalizeEmail(email));
    if (identity.userExists || identity.customerUserId) {
      throw new ConflictError(accountRecoveryMessage);
    }
  }

  async linkVerifiedUser(user: VerifiedCustomerUserInput) {
    const name = user.name.trim();
    const email = normalizeEmail(user.email);
    const phone = user.phone?.trim();
    if (!name || !phone) {
      throw new ValidationError("Tên và số điện thoại cần có để tạo hồ sơ Customer.");
    }

    const verifiedUser: VerifiedCustomerRegistrationUser = {
      id: user.id,
      name,
      email,
      phone,
    };
    return this.repository.reconcileVerifiedUser(verifiedUser);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
