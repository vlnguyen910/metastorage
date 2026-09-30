import { ConflictError, ValidationError } from "../../common/errors/app-error";
import { CUSTOMER_REGISTRATION_MESSAGES } from "./customer-registration.messages";
import type { CustomerRegistrationRepository } from "./customer-registration.repository";
import type {
  VerifiedCustomerRegistrationUser,
  VerifiedCustomerUserInput,
} from "./customer-registration.types";

export class CustomerRegistrationService {
  constructor(private readonly repository: CustomerRegistrationRepository) {}

  async assertEmailCanRegister(email: string): Promise<void> {
    const identity = await this.repository.findRegistrationIdentity(normalizeEmail(email));
    if (identity.userExists || identity.customerUserId) {
      throw new ConflictError(CUSTOMER_REGISTRATION_MESSAGES.accountRecovery);
    }
  }

  async linkVerifiedUser(user: VerifiedCustomerUserInput) {
    const name = user.name.trim();
    const email = normalizeEmail(user.email);
    const phone = user.phone?.trim();
    if (!name || !phone) {
      throw new ValidationError(CUSTOMER_REGISTRATION_MESSAGES.customerNameAndPhoneRequired);
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
