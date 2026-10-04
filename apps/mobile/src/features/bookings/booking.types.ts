import type { CustomerBooking } from "@metastorage/contracts";
import type { ReactNode } from "react";

export interface BookingButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface BookingRowProps {
  label: string;
  value: string;
}

export interface BookingPanelProps {
  children: ReactNode;
}

export interface BookingCardProps {
  booking: CustomerBooking;
  onPress: () => void;
}

export interface BookingDetailScreenProps {
  bookingId: string;
  onBack: () => void;
}

export interface BookingDialogProps {
  booking: CustomerBooking;
  mode: "cancel" | "reschedule" | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export interface CustomerBookingsFlowProps {
  userId: string;
}

export interface BookingListScreenProps {
  onSelect: (id: string) => void;
}
