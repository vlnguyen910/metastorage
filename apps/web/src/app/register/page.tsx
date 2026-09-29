import { PublicLayout } from "@/components/layout/public-layout";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <PublicLayout>
      <main className="min-h-[calc(100vh-74px)] bg-[linear-gradient(120deg,#0f493b_0_42%,#f4f7f6_42%)] py-12 max-[800px]:bg-[#f4f7f6]">
        <div className="mx-auto grid w-[min(1180px,calc(100%_-_40px))] grid-cols-[0.8fr_1.2fr] items-center gap-20 max-[1024px]:gap-9 max-[800px]:w-[min(100%_-_28px,680px)] max-[800px]:grid-cols-1">
          <div className="text-white max-[800px]:hidden">
            <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-[#cce7df] uppercase">
              Bắt đầu với storeX
            </span>
            <h2 className="my-3 text-[3.4rem] font-bold max-[1024px]:text-[2.7rem]">
              Lịch sử thuê kho, trong tầm tay.
            </h2>
            <p className="text-[#cee3dd]">
              Xác minh email để liên kết an toàn các lượt thuê trước đây có cùng địa chỉ email.
            </p>
          </div>
          <RegisterForm />
        </div>
      </main>
    </PublicLayout>
  );
}
