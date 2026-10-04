"use client";

import type { ApiStorageUnit, StorageUnitStatus } from "@metastorage/contracts";
import { AlertTriangle, ArrowUpDown, Filter, RefreshCw, Search, Warehouse } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Currency, StatusBadge } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useAvailability, useFacilityUnits } from "./hooks";
import { UnitStatusModal } from "./unit-status-modal";
import { UNIT_TRANSITIONS_MESSAGES } from "./unit-transitions.messages";
import type { PhysicalUnitsViewProps, UnitFilterState } from "./unit-transitions.types";

export function PhysicalUnitsView({ facilityId, facilityName }: PhysicalUnitsViewProps) {
  const [filters, setFilters] = useState<UnitFilterState>({
    status: "",
    unitTypeId: "",
    search: "",
  });

  const [selectedUnit, setSelectedUnit] = useState<ApiStorageUnit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: units,
    isLoading,
    isError,
    refetch,
  } = useFacilityUnits(facilityId, {
    status: (filters.status || undefined) as StorageUnitStatus | undefined,
    unitTypeId: filters.unitTypeId || undefined,
    search: filters.search || undefined,
  });

  const { data: unitTypes } = useAvailability(facilityId);

  const handleOpenTransitionModal = (unit: ApiStorageUnit) => {
    setSelectedUnit(unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedUnit(null);
    setIsModalOpen(false);
  };

  const resetFilters = () => {
    setFilters({
      status: "",
      unitTypeId: "",
      search: "",
    });
  };

  const hasActiveFilters = Boolean(filters.status || filters.unitTypeId || filters.search);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            <span>{UNIT_TRANSITIONS_MESSAGES.sectionTitle}</span>
            {facilityName && (
              <span className="text-sm font-normal text-muted">— {facilityName}</span>
            )}
          </h2>
          <p className="text-xs text-muted mt-1">{UNIT_TRANSITIONS_MESSAGES.sectionSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs py-2 px-3"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tải lại</span>
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 items-center">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={UNIT_TRANSITIONS_MESSAGES.searchPlaceholder}
              className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-xl border border-line bg-surface py-2 pl-8 pr-3 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
            >
              <option value="">{UNIT_TRANSITIONS_MESSAGES.filterAllStatus}</option>
              <option value="AVAILABLE">{UNIT_TRANSITIONS_MESSAGES.statusAvailable}</option>
              <option value="MAINTENANCE">{UNIT_TRANSITIONS_MESSAGES.statusMaintenance}</option>
              <option value="INSPECTION">{UNIT_TRANSITIONS_MESSAGES.statusInspection}</option>
              <option value="RESERVED">{UNIT_TRANSITIONS_MESSAGES.statusReserved}</option>
              <option value="OCCUPIED">{UNIT_TRANSITIONS_MESSAGES.statusOccupied}</option>
              <option value="RETURN_PENDING">
                {UNIT_TRANSITIONS_MESSAGES.statusReturnPending}
              </option>
              <option value="LOCKED">{UNIT_TRANSITIONS_MESSAGES.statusLocked}</option>
              <option value="INACTIVE">{UNIT_TRANSITIONS_MESSAGES.statusInactive}</option>
            </select>
          </div>

          {/* Unit Type Filter */}
          <div>
            <select
              value={filters.unitTypeId}
              onChange={(e) => setFilters((prev) => ({ ...prev, unitTypeId: e.target.value }))}
              className="w-full rounded-xl border border-line bg-surface py-2 px-3 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
            >
              <option value="">{UNIT_TRANSITIONS_MESSAGES.filterAllTypes}</option>
              {unitTypes?.map((ut) => (
                <option key={ut.unitTypeId} value={ut.unitTypeId}>
                  {ut.unitType} ({ut.sizeLabel})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="text-xs text-muted hover:text-ink w-full justify-center"
              >
                {UNIT_TRANSITIONS_MESSAGES.clearFilters}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Units Content */}
      {isLoading ? (
        <LoadingState label="Đang tải danh sách ô kho..." />
      ) : isError ? (
        <ErrorState message={UNIT_TRANSITIONS_MESSAGES.loadUnitsError} onRetry={() => refetch()} />
      ) : !units || units.length === 0 ? (
        <EmptyState
          title={UNIT_TRANSITIONS_MESSAGES.emptyTitle}
          description={UNIT_TRANSITIONS_MESSAGES.emptyDesc}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-line bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">{UNIT_TRANSITIONS_MESSAGES.colCode}</th>
                  <th className="px-4 py-3.5">{UNIT_TRANSITIONS_MESSAGES.colType}</th>
                  <th className="px-4 py-3.5">{UNIT_TRANSITIONS_MESSAGES.colFloorLocation}</th>
                  <th className="px-4 py-3.5">{UNIT_TRANSITIONS_MESSAGES.colStatus}</th>
                  <th className="px-4 py-3.5">{UNIT_TRANSITIONS_MESSAGES.colCurrentBooking}</th>
                  <th className="px-4 py-3.5 text-right">{UNIT_TRANSITIONS_MESSAGES.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {units.map((unit) => {
                  const isInUse =
                    unit.status === "RESERVED" ||
                    unit.status === "OCCUPIED" ||
                    Boolean(unit.currentBookingId);

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-ink">{unit.code}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-ink">{unit.unitTypeName ?? "—"}</div>
                        <div className="text-[11px] text-muted">
                          {unit.unitTypeSize ? `${unit.unitTypeSize} m² · ` : ""}
                          {unit.monthlyPrice ? (
                            <span>
                              <Currency value={unit.monthlyPrice} />
                              /tháng
                            </span>
                          ) : (
                            ""
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        <div>{unit.floor ? `Tầng ${unit.floor}` : "—"}</div>
                        {unit.locationDescription && (
                          <div className="text-[11px] text-slate-500">
                            {unit.locationDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge value={unit.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {unit.currentBookingCode ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary">
                            {unit.currentBookingCode}
                          </span>
                        ) : (
                          <span className="text-muted">
                            {UNIT_TRANSITIONS_MESSAGES.noBookingAssigned}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {isInUse ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 cursor-not-allowed"
                            title="Ô kho đang trong chu kỳ sử dụng / đơn đặt chỗ"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Đang sử dụng
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenTransitionModal(unit)}
                            className="text-xs py-1.5 px-3 h-auto"
                          >
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            {UNIT_TRANSITIONS_MESSAGES.actionChangeStatus}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transition Modal */}
      <UnitStatusModal
        unit={selectedUnit}
        facilityId={facilityId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
