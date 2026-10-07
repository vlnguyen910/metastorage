"use client";

import { UserRole } from "@metastorage/contracts";
import { BarChart3, UserCheck } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { StaffTasksView } from "@/features/check-in/staff-tasks-view";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";
import { STAFF_DASHBOARD_MESSAGES } from "./staff-dashboard.messages";

export function FacilityStaffDashboardScreen() {
  const [activeTab, setActiveTab] = useState<"tasks" | "overview">("tasks");
  const assignments = useMyFacilityAssignments();
  const facilityId = assignments.data?.[0]?.facilityId;

  if (assignments.isLoading) return <LoadingState />;
  if (assignments.isError) {
    return (
      <ErrorState
        message={STAFF_DASHBOARD_MESSAGES.assignmentsFailed}
        onRetry={() => assignments.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "tasks"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Nhiệm vụ Check-in & Bàn giao
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
          Tổng quan cơ sở & KPIs
        </button>
      </div>

      {activeTab === "tasks" ? (
        <StaffTasksView facilityId={facilityId} />
      ) : (
        <RoleDashboard role={UserRole.FACILITY_STAFF} />
      )}
    </div>
  );
}
