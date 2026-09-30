"use client";

import type { UserRole } from "@metastorage/contracts";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { AppShell } from "./app-shell";

export function ProtectedArea({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authReady = useAuthStore((state) => state.authReady);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (!session)
      router.replace(`${routes.login}?returnTo=${encodeURIComponent(location.pathname)}`);
    else if (session.user.role !== allowedRole) router.replace(routes.forbidden);
  }, [allowedRole, authReady, hydrated, router, session]);

  if (!hydrated || !authReady || !session || session.user.role !== allowedRole) {
    return (
      <main className="grid min-h-screen place-items-center p-8">
        <LoadingState label="Đang xác thực quyền truy cập…" />
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
