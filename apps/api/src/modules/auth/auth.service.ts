import { auth } from "./auth";

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return (await auth.$context).password.hash(password);
  }
}
