import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/public-layout";
import { FacilityList } from "@/features/facilities/facility-list";

export const metadata: Metadata = { title: "Tìm cơ sở" };
export default function FacilitiesPage() {
  return (
    <PublicLayout>
      <main className="min-h-[70vh] py-16 pb-[90px]">
        <div className="mx-auto w-[min(1180px,calc(100%_-_40px))] max-[800px]:w-[min(100%_-_28px,680px)]">
          <div className="mb-8 max-w-[680px]">
            <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Mạng lưới metastorage
            </span>
            <h1 className="mb-3 text-5xl font-bold max-[560px]:text-4xl">Tìm kho gần bạn</h1>
            <p className="text-muted">
              So sánh vị trí, kích thước, giá và số lượng còn trống tại từng cơ sở.
            </p>
          </div>
          <FacilityList />
        </div>
      </main>
    </PublicLayout>
  );
}
