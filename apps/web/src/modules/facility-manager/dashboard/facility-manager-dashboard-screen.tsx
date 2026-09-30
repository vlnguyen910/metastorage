"use client";

import { UserRole } from "@storex/contracts";
import { BarChart3, Warehouse } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export function FacilityManagerDashboardScreen() {
  const [activeTab, setActiveTab] = useState<"check-in" | "overview">("check-in");
  const { data: assignments, isLoading, isError, refetch } = useMyFacilityAssignments();

  const assignment = assignments?.find((item) => item.isActive) ?? assignments?.[0];

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("check-in")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "check-in"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Warehouse className="h-4 w-4" />
          Chuẩn bị Check-in & Gán ô kho (M2)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Tổng quan vận hành & KPIs
        </button>
      </div>

      {activeTab === "check-in" ? (
        isLoading ? (
          <LoadingState label="Đang tải thông tin cơ sở…" />
        ) : isError ? (
          <ErrorState
            message="Không thể tải cơ sở được phân công. Vui lòng kiểm tra phiên đăng nhập và thử lại."
            onRetry={() => refetch()}
          />
        ) : !assignment ? (
          <EmptyState
            title="Chưa được gán cơ sở"
            description="Tài khoản quản lý hiện chưa có cơ sở hoạt động. Hãy liên hệ quản trị viên để được phân công."
          />
        ) : (
          <FacilityBookingsView
            facilityId={assignment.facilityId}
            facilityName={assignment.facilityName}
          />
        )
      ) : (
        <RoleDashboard role={UserRole.FACILITY_MANAGER} />
      )}
    </div>
  );
}
