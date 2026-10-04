import type { ApiStorageUnit } from "@metastorage/contracts";

export interface PhysicalUnitsViewProps {
  facilityId: string;
  facilityName?: string;
}

export interface UnitStatusModalProps {
  unit: ApiStorageUnit | null;
  facilityId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface UnitFilterState {
  status: string;
  unitTypeId: string;
  search: string;
}

export interface UnitStatusBadgeConfig {
  label: string;
  className: string;
  variant: "default" | "success" | "warning" | "destructive" | "secondary";
}
