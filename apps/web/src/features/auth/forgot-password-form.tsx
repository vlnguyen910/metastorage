"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { AUTH_MESSAGES } from "./auth.messages";

const schema = z.object({ email: z.string().email(AUTH_MESSAGES.invalidEmail) });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (sent)
    return (
      <div className="flex w-full max-w-[620px] flex-col items-center gap-3.5 rounded-[22px] bg-white p-9 text-center shadow-card max-[560px]:p-[24px_18px]">
        <span className="grid size-[50px] place-items-center rounded-[14px] bg-primary text-white">
          <MailCheck />
        </span>
        <h1 className="m-0 text-3xl font-bold">Kiểm tra hộp thư</h1>
        <p className="text-muted">{AUTH_MESSAGES.forgotPasswordRequestAccepted}</p>
        <Link className={buttonClassName("primary")} href={routes.login}>
          <ArrowLeft size={18} />
          Về trang đăng nhập
        </Link>
      </div>
    );
  return (
    <div className="w-full max-w-[620px] rounded-[22px] bg-white p-9 shadow-card max-[560px]:p-[24px_18px]">
      <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
        Khôi phục tài khoản
      </span>
      <h1 className="text-3xl font-bold">Quên mật khẩu?</h1>
      <p className="mb-6 text-muted">
        Nhập email của bạn để nhận hướng dẫn. Hệ thống không tiết lộ tài khoản có tồn tại hay không.
      </p>
      <form
        className="grid gap-4"
        onSubmit={handleSubmit(async ({ email }) => {
          await api.auth.forgotPassword(email);
          setSent(true);
        })}
      >
        <FieldShell label="Email" error={errors.email?.message}>
          <Input type="email" autoFocus {...register("email")} />
        </FieldShell>
        <Button loading={isSubmitting}>Gửi hướng dẫn</Button>
        <Link
          className="inline-flex items-center justify-self-center gap-2 font-extrabold text-primary"
          href={routes.login}
        >
          <ArrowLeft size={16} />
          Quay lại đăng nhập
        </Link>
      </form>
    </div>
  );
}
