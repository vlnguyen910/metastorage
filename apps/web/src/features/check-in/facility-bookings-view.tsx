"use client";

import type { BookingListItem } from "@storex/contracts";
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  Phone,
  Search,
  User,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { useFacilityBookings } from "./hooks";
import { UnitAssignmentModal } from "./unit-assignment-modal";

interface FacilityBookingsViewProps {
  facilityId: string;
  facilityName?: string;
}

export function FacilityBookingsView({ facilityId, facilityName }: FacilityBookingsViewProps) {
  const [selectedBooking, setSelectedBooking] = useState<BookingListItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: bookings, isLoading, isError, refetch } = useFacilityBookings(facilityId);

  if (isLoading) return <LoadingState />;
  if (isError)
    return (
      <ErrorState
        message="Không thể tải danh sách đơn đặt chỗ của cơ sở."
        onRetry={() => refetch()}
      />
    );

  const filteredBookings = (bookings ?? []).filter((booking) => {
    // Filter by status
    if (filterStatus === "UNASSIGNED" && booking.assignedUnit) return false;
    if (filterStatus === "ASSIGNED" && !booking.assignedUnit) return false;
    if (filterStatus !== "ALL" && filterStatus !== "UNASSIGNED" && filterStatus !== "ASSIGNED") {
      if (booking.status !== filterStatus) return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = booking.bookingCode.toLowerCase().includes(q);
      const matchName = booking.contactName.toLowerCase().includes(q);
      const matchPhone = booking.contactPhone.toLowerCase().includes(q);
      const matchUnit = booking.assignedUnit?.physicalUnitCode.toLowerCase().includes(q);
      return matchCode || matchName || matchPhone || matchUnit;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản lý Check-in & Bàn giao"
        title="Chuẩn bị & Gán ô kho"
        description={`Danh sách đơn đặt chỗ đã thanh toán tại ${facilityName || "cơ sở"}. Vui lòng chọn và gán ô kho vật lý (Physical Unit) phù hợp trước thời điểm khách hàng đến check-in.`}
      />

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted mr-1">
              <Filter className="h-3.5 w-3.5" /> Lọc:
            </span>
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "UNASSIGNED", label: "Chưa gán ô kho" },
              { id: "ASSIGNED", label: "Đã gán ô kho" },
              { id: "CONFIRMED", label: "Đã thanh toán (Confirmed)" },
              { id: "CHECKED_IN", label: "Đã nhận kho" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterStatus === tab.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên khách, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-line bg-surface py-1.5 pl-9 pr-4 text-xs text-ink placeholder:text-muted outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Warehouse className="h-12 w-12 text-muted/50 mb-3" />
          <h3 className="text-base font-bold text-ink">Không có đơn đặt chỗ nào phù hợp</h3>
          <p className="text-xs text-muted mt-1 max-w-sm">
            Hiện tại không có đơn đặt chỗ nào trong bộ lọc này hoặc chưa có đơn thanh toán mới.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => (
            <Card
              key={booking.id}
              className="transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-extrabold text-primary">
                      {booking.bookingCode}
                    </span>
                    <StatusBadge value={booking.status} />
                    {booking.assignedUnit ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Ô kho:{" "}
                        {booking.assignedUnit.physicalUnitCode}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        <Clock className="h-3 w-3" /> Chưa gán kho vật lý
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Cơ sở: <strong className="text-ink">{booking.facilityName}</strong> · Tạo ngày:{" "}
                    {formatDate(booking.createdAt)}
                  </p>
                </div>

                <div>
                  <Button
                    variant={booking.assignedUnit ? "outline" : "primary"}
                    className="min-h-9 px-3 text-xs"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <Warehouse className="h-4 w-4" />
                    {booking.assignedUnit ? "Đổi ô kho" : "Gán ô kho vật lý"}
                  </Button>
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="mt-4 grid grid-cols-4 gap-4 text-xs max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
                {/* Customer Snapshot */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Thông tin khách hàng
                  </span>
                  <p className="font-bold text-ink text-sm">{booking.contactName}</p>
                  <p className="text-muted flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {booking.contactPhone}
                  </p>
                  <p className="text-muted flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" /> {booking.contactEmail}
                  </p>
                </div>

                {/* Storage Unit Type */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5" /> Loại kho đã đặt
                  </span>
                  <p className="font-bold text-ink text-sm">{booking.unitTypeName}</p>
                  <p className="text-muted">Kích thước: {booking.unitTypeSizeLabel}</p>
                  <p className="text-muted">Thời hạn: {booking.requestedMonths} tháng</p>
                </div>

                {/* Rental Period / Check-in */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Lịch Check-in & Kỳ thuê
                  </span>
                  <p className="font-semibold text-ink">
                    Bắt đầu: {formatDate(booking.checkInSlotStart)}
                  </p>
                  <p className="text-muted">Kết thúc: {formatDate(booking.rentalEndAt)}</p>
                </div>

                {/* Total Payment & Assigned Unit Status */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" /> Tài chính & Gán kho
                  </span>
                  <p className="font-bold text-ink text-sm">
                    <Currency value={booking.totalAmount} />
                  </p>
                  <div className="mt-1">
                    {booking.assignedUnit ? (
                      <p className="text-xs text-emerald-700">
                        Đã gán: <strong>{booking.assignedUnit.physicalUnitCode}</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 font-medium">
                        Cần gán kho trước check-in
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Unit Assignment Modal */}
      {selectedBooking && (
        <UnitAssignmentModal
          booking={selectedBooking}
          isOpen={Boolean(selectedBooking)}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}
