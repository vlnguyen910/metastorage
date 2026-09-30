import { Suspense } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <PublicLayout>
      <main className="min-h-[calc(100vh-74px)] bg-[linear-gradient(120deg,#0f493b_0_42%,#f4f7f6_42%)] py-16 max-[800px]:bg-[#f4f7f6]">
        <div className="mx-auto grid w-[min(1180px,calc(100%_-_40px))] grid-cols-[0.8fr_1.2fr] items-center gap-20 max-[1024px]:gap-9 max-[800px]:w-[min(100%_-_28px,680px)] max-[800px]:grid-cols-1">
          <div className="text-white max-[800px]:hidden">
            <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-[#cce7df] uppercase">
              metastorage workspace
            </span>
            <h2 className="my-3 text-[3.4rem] font-bold max-[1024px]:text-[2.7rem]">
              Một tài khoản.
              <br />
              Mọi không gian.
            </h2>
            <p className="text-[#cee3dd]">
              Khách hàng quản lý reservation; đội ngũ vận hành theo dõi đúng cơ sở và đúng quyền
              hạn.
            </p>
            <div className="mt-11 flex items-center gap-4">
              <strong className="text-5xl">5</strong>
              <span className="max-w-[180px] text-[#cee3dd]">vai trò được phân quyền rõ ràng</span>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="w-full max-w-[620px] rounded-[22px] bg-white p-9 shadow-card">
                Đang tải…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </PublicLayout>
  );
}
