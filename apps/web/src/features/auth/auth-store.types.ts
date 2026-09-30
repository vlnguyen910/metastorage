import type { ClientSession, SessionTokens } from "@storex/contracts";

export interface AuthState {
  session: ClientSession | null;
  hydrated: boolean;
  authReady: boolean;
  setSession: (session: ClientSession) => void;
  updateTokens: (tokens: SessionTokens) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
  setAuthReady: (value: boolean) => void;
}
