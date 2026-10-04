"use client";

import { ALLOWED_STORAGE_UNIT_TRANSITIONS, type StorageUnitStatus } from "@metastorage/contracts";
import { AlertCircle, AlertTriangle, CheckCircle2, Warehouse, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import { useUpdateUnitStatusMutation } from "./hooks";
import { UNIT_TRANSITIONS_MESSAGES } from "./unit-transitions.messages";
import type { UnitStatusModalProps } from "./unit-transitions.types";

export function UnitStatusModal({
  unit,
  facilityId,
  isOpen,
  onClose,
  onSuccess,
}: UnitStatusModalProps) {
  const [targetStatus, setTargetStatus] = useState<StorageUnitStatus | "">("");
  const [notes, setNotes] = useState<string>("");
  const { showToast } = useToast();

  const updateMutation = useUpdateUnitStatusMutation(facilityId);

  if (!isOpen || !unit) return null;

  const currentStatus = unit.status;
  const allowedTransitions = ALLOWED_STORAGE_UNIT_TRANSITIONS[currentStatus] ?? [];
  const isInUse =
    currentStatus === "RESERVED" || currentStatus === "OCCUPIED" || Boolean(unit.currentBookingId);

  const getStatusLabel = (status: StorageUnitStatus): string => {
    const map: Record<StorageUnitStatus, string> = {
      AVAILABLE: UNIT_TRANSITIONS_MESSAGES.statusAvailable,
      RESERVED: UNIT_TRANSITIONS_MESSAGES.statusReserved,
      OCCUPIED: UNIT_TRANSITIONS_MESSAGES.statusOccupied,
      MAINTENANCE: UNIT_TRANSITIONS_MESSAGES.statusMaintenance,
      INSPECTION: UNIT_TRANSITIONS_MESSAGES.statusInspection,
      RETURN_PENDING: UNIT_TRANSITIONS_MESSAGES.statusReturnPending,
      LOCKED: UNIT_TRANSITIONS_MESSAGES.statusLocked,
      INACTIVE: UNIT_TRANSITIONS_MESSAGES.statusInactive,
    };
    return map[status] ?? status;
  };

  const getStatusDesc = (status: StorageUnitStatus): string => {
    const map: Record<StorageUnitStatus, string> = {
      AVAILABLE: UNIT_TRANSITIONS_MESSAGES.statusAvailableDesc,
      RESERVED: UNIT_TRANSITIONS_MESSAGES.statusReservedDesc,
      OCCUPIED: UNIT_TRANSITIONS_MESSAGES.statusOccupiedDesc,
      MAINTENANCE: UNIT_TRANSITIONS_MESSAGES.statusMaintenanceDesc,
      INSPECTION: UNIT_TRANSITIONS_MESSAGES.statusInspectionDesc,
      RETURN_PENDING: UNIT_TRANSITIONS_MESSAGES.statusReturnPendingDesc,
      LOCKED: UNIT_TRANSITIONS_MESSAGES.statusLockedDesc,
      INACTIVE: UNIT_TRANSITIONS_MESSAGES.statusInactiveDesc,
    };
    return map[status] ?? "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    try {
      await updateMutation.mutateAsync({
        unitId: unit.id,
        input: {
          status: targetStatus,
          notes: notes.trim() || undefined,
        },
      });

      showToast(
        UNIT_TRANSITIONS_MESSAGES.updateSuccess(unit.code, getStatusLabel(targetStatus)),
        "success",
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      let message: string = UNIT_TRANSITIONS_MESSAGES.updateError;
      if (err && typeof err === "object" && "response" in err) {
        const res = err as { response?: { data?: { message?: string } } };
        if (res.response?.data?.message) {
          message = res.response.data.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      showToast(message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">{UNIT_TRANSITIONS_MESSAGES.modalTitle}</h2>
              <p className="text-xs text-muted">{UNIT_TRANSITIONS_MESSAGES.modalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Unit Summary Card */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs">
            <div>
              <span className="text-muted">{UNIT_TRANSITIONS_MESSAGES.colCode}:</span>
              <p className="font-bold text-ink text-sm mt-0.5">{unit.code}</p>
            </div>
            <div>
              <span className="text-muted">{UNIT_TRANSITIONS_MESSAGES.colType}:</span>
              <p className="font-semibold text-ink mt-0.5">
                {unit.unitTypeName ?? "—"} {unit.unitTypeSize ? `(${unit.unitTypeSize} m²)` : ""}
              </p>
            </div>
            <div>
              <span className="text-muted">
                {UNIT_TRANSITIONS_MESSAGES.modalCurrentStatusLabel}
              </span>
              <div className="mt-0.5">
                <StatusBadge value={unit.status} />
              </div>
            </div>
          </div>

          {/* In-Use Warning */}
          {isInUse ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">{UNIT_TRANSITIONS_MESSAGES.modalInUseWarning}</p>
                {unit.currentBookingCode && (
                  <p className="mt-1">
                    {UNIT_TRANSITIONS_MESSAGES.colCurrentBooking}:{" "}
                    <strong>{unit.currentBookingCode}</strong>
                  </p>
                )}
              </div>
            </div>
          ) : allowedTransitions.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <AlertCircle className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
              <p>{UNIT_TRANSITIONS_MESSAGES.modalNoTransitionsAllowed}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="block text-xs font-bold text-ink">
                {UNIT_TRANSITIONS_MESSAGES.modalTargetStatusLabel}
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                {allowedTransitions.map((statusOption) => {
                  const isSelected = targetStatus === statusOption;
                  return (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setTargetStatus(statusOption)}
                      className={`flex flex-col text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-line bg-surface hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-ink">
                          {getStatusLabel(statusOption)}
                        </span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs text-muted leading-relaxed">
                        {getStatusDesc(statusOption)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes Textarea */}
          {!isInUse && allowedTransitions.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="unit-notes" className="block text-xs font-bold text-ink">
                {UNIT_TRANSITIONS_MESSAGES.modalNotesLabel}
              </label>
              <textarea
                id="unit-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={UNIT_TRANSITIONS_MESSAGES.modalNotesPlaceholder}
                className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              {UNIT_TRANSITIONS_MESSAGES.actionCancel}
            </Button>
            {!isInUse && allowedTransitions.length > 0 && (
              <Button
                variant="primary"
                type="submit"
                disabled={!targetStatus || updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? UNIT_TRANSITIONS_MESSAGES.actionProcessing
                  : UNIT_TRANSITIONS_MESSAGES.actionConfirmTransition}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
