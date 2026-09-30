import type { BookingListItem } from "@storex/contracts";

export interface UnitAssignmentModalProps {
  booking: BookingListItem;
  isOpen: boolean;
  onClose: () => void;
}
