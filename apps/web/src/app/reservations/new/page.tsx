import { Suspense } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { LoadingState } from "@/components/ui/states";
import { ReservationWizard } from "@/features/reservations/reservation-wizard";

export default function PublicReservationPage() {
  return (
    <PublicLayout>
      <main className="min-h-[70vh] py-16">
        <Suspense fallback={<LoadingState label="Đang chuẩn bị quy trình đặt kho…" />}>
          <ReservationWizard />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
