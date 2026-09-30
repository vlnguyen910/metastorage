"use client";

import type { CheckInLookupInput, CheckInLookupResult } from "@metastorage/contracts";
import axios from "axios";
import { AlertTriangle, CheckCircle2, Clock3, QrCode, Search, User, Warehouse } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { useCheckInConfirmMutation, useCheckInLookupMutation } from "./hooks";

const reasonLabels: Record<string, string> = {
  TOO_EARLY: "Chưa tới thời gian check-in.",
  DEADLINE_PASSED: "Đã quá grace period 2 giờ.",
  CHECKIN_SLOT_NOT_CONFIGURED: "Booking chưa có check-in slot đầy đủ.",
  INVALID_BOOKING_STATUS: "Trạng thái booking không cho phép check-in.",
  PAYMENT_NOT_SUCCEEDED: "Payment chưa ở trạng thái thành công.",
  UNIT_NOT_ASSIGNED: "Booking chưa được gán physical unit.",
};

function apiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Không thể xử lý yêu cầu check-in.";
  return (
    (error.response?.data as { message?: string } | undefined)?.message ??
    "Không thể xử lý yêu cầu check-in."
  );
}

function normalizeQrValue(value: string): string {
  try {
    const url = new URL(value.trim());
    return url.searchParams.get("token") ?? value.trim();
  } catch {
    return value.trim();
  }
}

export function CheckInScreen() {
  const { showToast } = useToast();
  const lookupMutation = useCheckInLookupMutation();
  const confirmMutation = useCheckInConfirmMutation();
  const [lookupType, setLookupType] = useState<CheckInLookupInput["type"]>("BOOKING_CODE");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<CheckInLookupResult | null>(null);

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedValue = lookupType === "QR_TOKEN" ? normalizeQrValue(value) : value.trim();
    if (!normalizedValue) {
      showToast("Nhập Booking ID hoặc quét QR trước khi tìm.", "error");
      return;
    }

    lookupMutation.mutate(
      { type: lookupType, value: normalizedValue },
      {
        onSuccess: setResult,
        onError: (error) => {
          setResult(null);
          showToast(apiErrorMessage(error), "error");
        },
      },
    );
  }

  function confirmVerification() {
    if (!result) return;
    confirmMutation.mutate(result.booking.id, {
      onSuccess: setResult,
      onError: (error) => showToast(apiErrorMessage(error), "error"),
    });
  }

  const reasons = result?.eligibility.reasons ?? [];
  const isVerified = result?.verification?.status === "VERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Check-in & Handover"
        title="Xác minh booking"
        description="Quét QR hoặc nhập Booking Code để kiểm tra booking trước khi bắt đầu handover."
      />

      <Card>
        <form
          className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-start"
          onSubmit={lookup}
        >
          <FieldShell label="Loại mã">
            <Select
              value={lookupType}
              onChange={(event) => {
                setLookupType(event.target.value as CheckInLookupInput["type"]);
                setResult(null);
              }}
            >
              <option value="BOOKING_CODE">Booking Code</option>
              <option value="QR_TOKEN">QR / Code</option>
            </Select>
          </FieldShell>
          <FieldShell
            label={lookupType === "QR_TOKEN" ? "QR token hoặc nội dung QR" : "Booking Code"}
            hint="QR scanner dạng keyboard có thể nhập trực tiếp URL QR vào ô này."
          >
            <Input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={lookupType === "QR_TOKEN" ? "Dán hoặc quét nội dung QR" : "SX-..."}
            />
          </FieldShell>
          <Button
            className="md:mt-[26px]"
            type="submit"
            loading={lookupMutation.isPending}
            icon={<Search size={18} />}
          >
            Tìm booking
          </Button>
        </form>
      </Card>

      {result ? (
        <Card className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-extrabold text-primary">
                  {result.booking.bookingCode}
                </span>
                <StatusBadge value={result.booking.status} />
              </div>
              <p className="mt-2 text-sm text-muted">Cơ sở: {result.booking.facilityName}</p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
                result.eligibility.canProceed || isVerified
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {result.eligibility.canProceed || isVerified ? (
                <CheckCircle2 size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
              {isVerified
                ? "Đã verify"
                : result.eligibility.canProceed
                  ? "Đủ điều kiện"
                  : "Chưa đủ điều kiện"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoBlock icon={<User size={18} />} title="Khách hàng">
              <strong>{result.booking.contactName}</strong>
              <span>{result.booking.contactPhone}</span>
              <span>{result.booking.contactEmail}</span>
            </InfoBlock>
            <InfoBlock icon={<Warehouse size={18} />} title="Physical unit">
              <strong>{result.assignedUnit?.physicalUnitCode ?? "Chưa gán unit"}</strong>
              <span>{result.booking.unitTypeName}</span>
              <span>{result.booking.unitTypeSizeLabel}</span>
            </InfoBlock>
            <InfoBlock icon={<Clock3 size={18} />} title="Thời gian check-in">
              <span>Bắt đầu: {formatDateTime(result.booking.checkInSlotStart)}</span>
              <span>Kết thúc slot: {formatDateTime(result.booking.checkInSlotEnd)}</span>
              <span>Grace đến: {formatDateTime(result.booking.graceEndsAt)}</span>
            </InfoBlock>
          </div>

          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <span className="text-xs font-bold text-muted">Trạng thái thanh toán</span>
              <div className="mt-1">
                {result.payment.status ? (
                  <StatusBadge value={result.payment.status} />
                ) : (
                  <span className="font-bold">Không có thanh toán</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-muted">Tổng tiền</span>
              <p className="mt-1 font-bold">
                {result.payment.totalAmount === null ? (
                  "—"
                ) : (
                  <Currency value={result.payment.totalAmount} />
                )}
              </p>
            </div>
            <div>
              <span className="text-xs font-bold text-muted">Thời điểm thanh toán</span>
              <p className="mt-1 font-bold">{formatDateTime(result.payment.paidAt)}</p>
            </div>
            <p className="text-xs text-muted md:col-span-3">
              Thanh toán thành công chỉ xác nhận giao dịch; booking vẫn phải đúng trạng thái, có
              physical unit và nằm trong thời gian check-in mới được tiếp tục.
            </p>
          </div>

          {reasons.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-bold">Không thể tiếp tục:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {reasons.map((reason) => (
                  <li key={reason}>{reasonLabels[reason] ?? reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <QrCode size={16} /> QR/Booking Code chỉ định vị booking; quyền đọc do staff scope
              quyết định.
            </div>
            <Button
              type="button"
              disabled={!result.eligibility.canProceed || isVerified}
              loading={confirmMutation.isPending}
              onClick={confirmVerification}
            >
              {isVerified ? "Đã xác nhận booking" : "Xác nhận đủ điều kiện"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function InfoBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-line p-4 text-sm">
      <span className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">
        {icon}
        {title}
      </span>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}
