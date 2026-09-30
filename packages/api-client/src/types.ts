import type { SessionTokens } from "@storex/contracts";
import type { InternalAxiosRequestConfig } from "axios";

export interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

export interface TokenProvider {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  updateTokens: (tokens: SessionTokens) => void;
  clearSession: () => void;
}

export interface HttpClientOptions {
  baseURL: string;
  tokenProvider: TokenProvider;
}
