"use client";

import { UserRole } from "@storex/contracts";
import { BarChart3, Warehouse } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export function FacilityManagerDashboardScreen() {
  const [activeTab, setActiveTab] = useState<"check-in" | "overview">("check-in");
  const user = useAuthStore((state) => state.session?.user);
  const facilityId = user?.assignedFacilityIds?.[0] ?? "f0000000-0000-0000-0000-000000000001";

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
        <FacilityBookingsView facilityId={facilityId} />
      ) : (
        <RoleDashboard role={UserRole.FACILITY_MANAGER} />
      )}
    </div>
  );
}
