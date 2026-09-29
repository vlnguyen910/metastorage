import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = Boolean(error);

  return (
    <PublicLayout>
      <main className="grid min-h-[calc(100vh-74px)] place-items-center bg-[#f4f7f6] px-4 py-12">
        <section
          className="w-full max-w-xl rounded-[22px] bg-white p-9 text-center shadow-card max-[560px]:p-[24px_18px]"
          aria-labelledby="verify-email-title"
        >
          <span
            className="mx-auto grid size-[50px] place-items-center rounded-[14px] bg-primary text-white"
            aria-hidden="true"
          >
            {failed ? "!" : "✓"}
          </span>
          <h1 id="verify-email-title" className="mt-5 text-3xl font-bold">
            {failed ? "Liên kết không còn hợp lệ" : "Email đã được xác minh"}
          </h1>
          <p className="mt-3 text-muted">
            {failed
              ? "Liên kết có thể đã hết hạn hoặc được sử dụng. Hãy đăng nhập để yêu cầu gửi lại liên kết xác minh."
              : "Hồ sơ Customer của bạn đã sẵn sàng. Đăng nhập để xem các lượt thuê gắn với email này."}
          </p>
          <Link className={`${buttonClassName("primary")} mt-6`} href={routes.login}>
            Đăng nhập
          </Link>
        </section>
      </main>
    </PublicLayout>
  );
}
