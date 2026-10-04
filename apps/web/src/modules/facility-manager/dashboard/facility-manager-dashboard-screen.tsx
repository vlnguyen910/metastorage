"use client";

import { UserRole } from "@metastorage/contracts";
import { ArrowRight, BarChart3, Boxes, Users, Warehouse } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FacilityBookingsView } from "@/features/check-in/facility-bookings-view";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { PhysicalUnitsView } from "@/features/facilities/physical-units-view";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { FACILITY_DASHBOARD_MESSAGES } from "./facility-dashboard.messages";
import type { FacilityManagerDashboardTab } from "./facility-dashboard.types";
import { FacilityStaffTab } from "./facility-staff-tab";

export function FacilityManagerDashboardScreen() {
  const [activeTab, setActiveTab] = useState<FacilityManagerDashboardTab>("overview");
  const {
    activeAssignments,
    currentFacility,
    currentFacilityId,
    isLoading,
    isError,
    refetch,
    switchFacility,
  } = useFacilityContext();

  if (isLoading) {
    return <LoadingState label={FACILITY_DASHBOARD_MESSAGES.loadingFacility} />;
  }

  if (isError) {
    return (
      <ErrorState
        message={FACILITY_DASHBOARD_MESSAGES.errorLoadFacility}
        onRetry={() => refetch()}
      />
    );
  }

  if (!currentFacility || activeAssignments.length === 0) {
    return (
      <EmptyState
        title={FACILITY_DASHBOARD_MESSAGES.noAssignmentTitle}
        description={FACILITY_DASHBOARD_MESSAGES.noAssignmentDescription}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Facility Context Switcher / Info Bar */}
      <FacilitySwitcher
        activeAssignments={activeAssignments}
        currentFacilityId={currentFacilityId}
        onSwitchFacility={switchFacility}
      />

      {/* Module Navigation Tabs */}
      <div className="flex border-b border-line gap-2">
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
          {FACILITY_DASHBOARD_MESSAGES.tabOverview}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("units")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "units"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Boxes className="h-4 w-4" />
          {FACILITY_DASHBOARD_MESSAGES.tabUnits}
        </button>
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
          {FACILITY_DASHBOARD_MESSAGES.tabCheckIn}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "staff"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users className="h-4 w-4" />
          {FACILITY_DASHBOARD_MESSAGES.tabStaff}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Capability Action Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="flex flex-col justify-between p-5 border-l-4 border-l-primary">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold text-base mb-1">
                  <Boxes className="h-5 w-5" />
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityUnitsTitle}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {FACILITY_DASHBOARD_MESSAGES.capabilityUnitsDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-line">
                <Button
                  variant="primary"
                  onClick={() => setActiveTab("units")}
                  className="flex items-center gap-1.5 text-xs py-2 px-3 min-h-9"
                >
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityUnitsAction}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 border-l-4 border-l-accent">
              <div>
                <div className="flex items-center gap-2 text-accent font-bold text-base mb-1">
                  <Warehouse className="h-5 w-5" />
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityCheckInTitle}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {FACILITY_DASHBOARD_MESSAGES.capabilityCheckInDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-line">
                <Button
                  variant="primary"
                  onClick={() => setActiveTab("check-in")}
                  className="flex items-center gap-1.5 text-xs py-2 px-3 min-h-9"
                >
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityCheckInAction}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 border-l-4 border-l-secondary">
              <div>
                <div className="flex items-center gap-2 text-secondary font-bold text-base mb-1">
                  <Users className="h-5 w-5" />
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityStaffTitle}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {FACILITY_DASHBOARD_MESSAGES.capabilityStaffDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-line">
                <Button
                  variant="secondary"
                  onClick={() => setActiveTab("staff")}
                  className="flex items-center gap-1.5 text-xs py-2 px-3 min-h-9"
                >
                  <span>{FACILITY_DASHBOARD_MESSAGES.capabilityStaffAction}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Operational Metrics and KPI Dashboard */}
          <RoleDashboard role={UserRole.FACILITY_MANAGER} facilityId={currentFacilityId} />
        </div>
      )}

      {activeTab === "units" && (
        <PhysicalUnitsView
          facilityId={currentFacilityId}
          facilityName={currentFacility.facilityName}
        />
      )}

      {activeTab === "check-in" && (
        <FacilityBookingsView
          facilityId={currentFacilityId}
          facilityName={currentFacility.facilityName}
        />
      )}

      {activeTab === "staff" && (
        <FacilityStaffTab
          facilityId={currentFacilityId}
          facilityName={currentFacility.facilityName}
        />
      )}
    </div>
  );
}
