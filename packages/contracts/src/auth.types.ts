import type { User } from "./users";

export interface CookieSession {
  user: User;
}

export interface Session extends CookieSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
