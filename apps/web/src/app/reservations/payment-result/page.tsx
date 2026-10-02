"use client";

import type { PaymentResult } from "@metastorage/contracts";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Suspense, useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const paymentId = searchParams.get("paymentId");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId || status !== "success") {
      setLoading(false);
      return;
    }

    let isMounted = true;
    api.payments
      .confirmSandbox(paymentId)
      .then((data) => {
        if (!isMounted) return;
        setResult(data);
        if (data.confirmation?.qrUrl) {
          QRCode.toDataURL(data.confirmation.qrUrl, { margin: 1, width: 260 })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(null));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Không thể xác nhận giao dịch thanh toán.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [paymentId, status]);

  if (loading) {
    return <LoadingState label="Đang kiểm tra kết quả thanh toán từ SePay Sandbox…" />;
  }

  if (status !== "success" || error) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
          <XCircle size={36} />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-800">Thanh toán chưa hoàn tất</h2>
        <p className="mb-6 text-sm text-slate-600">
          {error ?? "Giao dịch thanh toán trên SePay đã bị hủy hoặc xảy ra gián đoạn."}
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/reservations/new">
            <Button variant="primary">Thử lại quy trình đặt kho</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Trang chủ</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>
        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">
          SePay PG Sandbox Verified
        </span>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Thanh toán thành công!</h2>
        <p className="mt-1 text-sm text-slate-600">Đơn đặt kho của bạn đã được xác nhận tự động.</p>
      </div>

      {result ? (
        <div className="mb-6 grid gap-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Mã đặt kho:</span>
            <strong className="font-mono text-base text-primary">
              {result.booking.bookingCode}
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Số tiền đã trả:</span>
            <strong>
              {Number(result.booking.pricing.totalAmount).toLocaleString("vi-VN")}{" "}
              {result.booking.pricing.currency}
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Thời gian thuê:</span>
            <span>{result.booking.durationMonths} tháng</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Trạng thái:</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              CONFIRMED
            </span>
          </div>

          {qrDataUrl ? (
            <div className="mt-4 flex flex-col items-center">
              <span className="mb-2 text-xs font-medium text-slate-500">
                Mã QR Check-in khi đến nhận kho:
              </span>
              <Image
                src={qrDataUrl}
                alt="Check-in QR"
                width={192}
                height={192}
                unoptimized
                className="size-48 rounded-lg border bg-white p-2 shadow-sm"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button variant="secondary">Về trang chủ</Button>
        </Link>
        <Link href="/reservations/new">
          <Button variant="primary">
            Đặt kho khác <ArrowRight size={16} className="ml-1" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function PaymentResultPage() {
  return (
    <PublicLayout>
      <main className="min-h-[70vh] py-16">
        <h1 className="sr-only">Kết quả thanh toán</h1>
        <Suspense fallback={<LoadingState label="Đang tải kết quả thanh toán…" />}>
          <PaymentResultContent />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
