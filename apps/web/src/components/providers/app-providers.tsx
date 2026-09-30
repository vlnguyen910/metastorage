"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import { installMockApi } from "@/mocks/install-mock-api";
import { GlobalActivityIndicator } from "./global-activity-indicator";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const isMockMode = process.env.NEXT_PUBLIC_API_MODE === "mock";
  const [ready, setReady] = useState(!isMockMode);

  useEffect(() => {
    if (isMockMode) {
      installMockApi(api.http);
      useAuthStore.getState().setAuthReady(true);
      setReady(true);
      return;
    }

    const { clearSession, setSession, setAuthReady } = useAuthStore.getState();
    clearSession();
    setAuthReady(false);
    api.auth
      .me()
      .then((user) => setSession({ user }))
      .catch(() => clearSession())
      .finally(() => setAuthReady(true));
  }, [isMockMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GlobalActivityIndicator />
        {ready ? (
          children
        ) : (
          <div className="grid min-h-screen place-items-center p-8">Đang khởi tạo metastorage…</div>
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
