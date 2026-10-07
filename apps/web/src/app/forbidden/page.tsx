"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { roleHome, routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";

export default function ForbiddenPage() {
  const session = useAuthStore((state) => state.session);
  return (
    <main className="grid min-h-screen place-items-center p-8">
      <div className="mx-auto my-8 flex min-h-[260px] w-full max-w-[620px] flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-10 text-center">
        <ShieldX className="size-10 text-primary" />
        <span className="mt-3 mb-2 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
          403 · Forbidden
        </span>
        <h1 className="mb-1 text-3xl font-bold">Bạn không có quyền truy cập</h1>
        <p className="max-w-[460px] text-muted">
          Route này không thuộc vai trò hoặc phạm vi facility của tài khoản hiện tại.
        </p>
        <Link
          className={buttonClassName("primary")}
          href={session?.user.role ? roleHome[session.user.role] : routes.login}
        >
          Về khu vực của tôi
        </Link>
      </div>
    </main>
  );
}
