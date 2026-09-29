import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/auth`,
  plugins: [
    expoClient({
      scheme: "storex",
      storagePrefix: "storex",
      cookiePrefix: "storex-auth",
      storage: SecureStore,
    }),
  ],
});
