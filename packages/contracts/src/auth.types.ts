import type { User } from "./users";

export interface CookieSession {
  user: User;
}

export interface LoginInput {
  email: string;
  password: string;
}
