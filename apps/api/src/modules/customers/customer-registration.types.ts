export interface VerifiedCustomerUserInput {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface VerifiedCustomerRegistrationUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}
