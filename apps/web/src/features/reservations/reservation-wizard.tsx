"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  BookingConfirmation,
  ReservationDraft,
  ReservationHold,
  UnitAvailabilityOption,
} from "@storex/contracts";
import axios from "axios";
import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, Currency } from "@/components/ui/display";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAvailability, useFacilities } from "@/features/facilities/hooks";
import { cn } from "@/lib/cn";
import { dateInputMin } from "@/lib/format";
import { useReservationDraft, useReservationHold } from "./hooks";

const wizardSchema = z.object({
  facilityId: z.string().min(1, "Chọn một cơ sở"),
  unitTypeId: z.string().min(1, "Chọn loại kho"),
  checkInAt: z.string().min(1, "Chọn thời gian check-in"),
  durationMonths: z.number().int().min(1).max(12),
  fullName: z.string().trim().min(2, "Nhập họ tên"),
  email: z.string().email("Email chưa đúng định dạng"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Dùng số điện thoại dạng +84901234567"),
});
type WizardValues = z.input<typeof wizardSchema>;

function apiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Đã có lỗi xảy ra, vui lòng thử lại.";
  return (
    (error.response?.data as { message?: string } | undefined)?.message ??
    "Không thể tạo reservation draft."
  );
}

function toApiDateTime(localValue: string): string {
  return new Date(`${localValue}:00+07:00`).toISOString();
}

export function ReservationWizard() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ReservationDraft | null>(null);
  const [hold, setHold] = useState<ReservationHold | null>(null);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [confirmation] = useState<BookingConfirmation | null>(null);
  const facilitiesQuery = useFacilities({ pageSize: 20 });
  const draftMutation = useReservationDraft();
  const holdMutation = useReservationHold();
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      facilityId: searchParams.get("facilityId") ?? "",
      unitTypeId: "",
      checkInAt: `${dateInputMin()}T09:00`,
      durationMonths: 1,
      fullName: "",
      email: "",
      phone: "+84",
    },
  });
  const facilityId = form.watch("facilityId");
  const unitTypeId = form.watch("unitTypeId");
  const availabilityQuery = useAvailability(facilityId);
  const selectedFacility = facilitiesQuery.data?.items.find((item) => item.id === facilityId);
  const selectedOption = availabilityQuery.data?.find((item) => item.unitTypeId === unitTypeId);

  useEffect(() => {
    const facilityParam = searchParams.get("facilityId");
    if (facilityParam) form.setValue("facilityId", facilityParam);
  }, [form, searchParams]);

  useEffect(() => {
    if (!hold) return;
    const update = () =>
      setHoldSeconds(
        Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

  async function next() {
    if (step === 0 && (await form.trigger("facilityId"))) setStep(1);
    else if (step === 1 && (await form.trigger("unitTypeId"))) setStep(2);
    else if (
      step === 2 &&
      (await form.trigger(["checkInAt", "durationMonths", "fullName", "email", "phone"]))
    ) {
      const values = form.getValues();
      try {
        const checkInAt = toApiDateTime(values.checkInAt);
        const reusableDraft =
          draft &&
          draft.facilityId === values.facilityId &&
          draft.unitTypeId === values.unitTypeId &&
          draft.checkInAt === checkInAt &&
          draft.durationMonths === Number(values.durationMonths) &&
          draft.contact.fullName === values.fullName &&
          draft.contact.email === values.email &&
          draft.contact.phone === values.phone
            ? draft
            : null;
        const created =
          reusableDraft ??
          (await draftMutation.mutateAsync({
            facilityId: values.facilityId,
            unitTypeId: values.unitTypeId,
            checkInAt,
            durationMonths: Number(values.durationMonths),
            contact: { fullName: values.fullName, email: values.email, phone: values.phone },
          }));
        if (!reusableDraft) setDraft(created);
        const createdHold = await holdMutation.mutateAsync({
          draftId: created.id,
          draftAccessToken: created.draftAccessToken,
        });
        setHold(createdHold);
        setStep(3);
      } catch (error) {
        showToast(apiErrorMessage(error), "error");
      }
    }
  }

  if (facilitiesQuery.isLoading) return <LoadingState label="Đang chuẩn bị reservation draft…" />;
  if (facilitiesQuery.isError) {
    return (
      <ErrorState
        message="Không tải được danh sách cơ sở."
        onRetry={() => facilitiesQuery.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <Card className="mx-auto flex min-h-[510px] w-full max-w-[900px] flex-col max-[560px]:p-[19px]">
        <ol className="relative mb-7 flex list-none justify-between p-0 before:absolute before:top-[17px] before:right-[7%] before:left-[7%] before:h-0.5 before:bg-slate-200">
          {["Cơ sở", "Unit Type", "Thông tin thuê", "Draft", "Confirmation"].map((label, index) => (
            <li
              key={label}
              className={cn(
                "z-[1] grid justify-items-center gap-1 font-bold text-slate-400",
                index <= step && "text-primary",
              )}
            >
              <span
                className={cn(
                  "grid size-[35px] place-items-center rounded-full border-2 border-slate-200 bg-white",
                  index <= step && "border-primary bg-primary text-white",
                )}
              >
                {index < step ? <Check size={15} /> : index + 1}
              </span>
              <small className="text-[0.7rem] max-[560px]:hidden">{label}</small>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Chọn cơ sở</h2>
            <p className="mb-6 text-muted">Chọn facility trước khi tạo reservation draft.</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {facilitiesQuery.data?.items.map((facility) => (
                <button
                  type="button"
                  key={facility.id}
                  className={cn(
                    "relative flex min-h-[150px] cursor-pointer flex-col gap-2 rounded-[13px] border border-slate-300 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-soft",
                    facilityId === facility.id &&
                      "border-primary bg-primary-soft ring-2 ring-primary ring-offset-2 shadow-soft",
                  )}
                  onClick={() => {
                    form.setValue("facilityId", facility.id, { shouldValidate: true });
                    form.setValue("unitTypeId", "");
                  }}
                >
                  <MapPin className="text-primary" />
                  <strong>{facility.name}</strong>
                  <small className="text-muted">{facility.address}</small>
                  {facilityId === facility.id ? (
                    <span
                      className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-primary text-white"
                      aria-hidden="true"
                    >
                      <Check size={14} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="mb-1 text-2xl font-bold">Chọn Unit Type</h2>
            <p className="mb-6 text-muted">
              Bạn chọn loại kho; physical unit sẽ được phân công sau.
            </p>
            {availabilityQuery.isLoading ? <LoadingState /> : null}
            <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              {availabilityQuery.data?.map((option: UnitAvailabilityOption) => (
                <button
                  type="button"
                  disabled={option.availableCount === 0}
                  key={option.unitTypeId}
                  className={cn(
                    "relative flex min-h-[150px] cursor-pointer flex-col gap-2 rounded-[13px] border border-slate-300 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-50",
                    unitTypeId === option.unitTypeId &&
                      "border-primary bg-primary-soft ring-2 ring-primary ring-offset-2 shadow-soft",
                  )}
                  onClick={() =>
                    form.setValue("unitTypeId", option.unitTypeId, { shouldValidate: true })
                  }
                >
                  <strong>{option.unitType}</strong>
                  <span>{option.sizeLabel}</span>
                  <Currency value={option.monthlyPrice} />
                  <small className="mt-auto text-accent">Còn {option.availableCount} chỗ</small>
                  {unitTypeId === option.unitTypeId ? (
                    <span
                      className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-primary text-white"
                      aria-hidden="true"
                    >
                      <Check size={14} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            <h2 className="mb-1 text-2xl font-bold">Thông tin reservation draft</h2>
            <FieldShell label="Check-in" error={form.formState.errors.checkInAt?.message}>
              <Input
                type="datetime-local"
                min={`${dateInputMin()}T00:00`}
                {...form.register("checkInAt")}
              />
            </FieldShell>
            <FieldShell label="Số tháng thuê" error={form.formState.errors.durationMonths?.message}>
              <Select {...form.register("durationMonths", { valueAsNumber: true })}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option value={month} key={month}>
                    {month} tháng
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell label="Họ tên" error={form.formState.errors.fullName?.message}>
              <Input {...form.register("fullName")} />
            </FieldShell>
            <FieldShell label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </FieldShell>
            <FieldShell label="Phone (+84...)" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} />
            </FieldShell>
          </div>
        ) : null}

        {step === 3 && draft && hold ? (
          <div className="grid gap-4">
            <span className="text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Draft đã tạo
            </span>
            <h2 className="text-2xl font-bold">Kiểm tra thông tin</h2>
            <div className="grid gap-3 rounded-xl bg-primary-soft p-5">
              <div className="flex justify-between gap-4">
                <span>Facility</span>
                <strong>{selectedFacility?.name}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Unit Type</span>
                <strong>
                  {selectedOption?.unitType} · {selectedOption?.sizeLabel}
                </strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Thời hạn</span>
                <strong>{draft.durationMonths} tháng</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Pricing</span>
                <strong>Chưa cấu hình</strong>
              </div>
            </div>
            <div className="flex justify-between gap-4 rounded-lg border border-primary/20 bg-primary-soft p-3">
              <span>Hold còn lại</span>
              <strong>
                {holdSeconds > 0
                  ? `${Math.floor(holdSeconds / 60)}:${String(holdSeconds % 60).padStart(2, "0")}`
                  : "Đã hết hạn"}
              </strong>
            </div>
            <p className="text-muted">
              Draft đã lưu. Rental fee và deposit sẽ được tính khi pricing policy #42 được cấu hình.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div>
                <strong className="block text-sm text-amber-900">Thanh toán chưa khả dụng</strong>
                <span className="text-sm text-amber-800">
                  Pricing policy chưa cấu hình nên chưa thể tạo Paid Booking.
                </span>
              </div>
              <Button type="button" disabled variant="primary">
                Thanh toán
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 && confirmation ? (
          <div className="grid gap-4">
            <span className="text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Booking confirmed
            </span>
            <h2 className="text-2xl font-bold">Xác nhận đặt kho</h2>
            <div className="grid gap-3 rounded-xl bg-primary-soft p-5">
              <div className="flex justify-between gap-4">
                <span>Booking ID</span>
                <strong>{confirmation.bookingCode}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cơ sở</span>
                <strong>{confirmation.facility.name}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Check-in</span>
                <strong>{confirmation.checkInSlotStart}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Email</span>
                <strong>{confirmation.emailStatus}</strong>
              </div>
            </div>
            <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-5">
              <Image
                src={confirmation.qrUrl}
                alt={`QR check-in cho ${confirmation.bookingCode}`}
                className="size-48 rounded-lg object-contain"
                width={192}
                height={192}
                unoptimized
              />
            </div>
            <p className="text-muted">
              Email confirmation sẽ được gửi theo trạng thái hiển thị ở trên.
            </p>
          </div>
        ) : null}

        {step < 3 ? (
          <div className="mt-auto flex justify-between pt-7">
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setStep((value) => value - 1)}
                icon={<ArrowLeft size={18} />}
                type="button"
              >
                Quay lại
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              onClick={next}
              loading={draftMutation.isPending || holdMutation.isPending}
              icon={<ArrowRight size={18} />}
            >
              Tiếp tục
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
