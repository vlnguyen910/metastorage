import { Pressable, Text, View } from "react-native";
import { BOOKING_MESSAGES } from "../booking.messages";
import type {
  BookingButtonProps,
  BookingCardProps,
  BookingPanelProps,
  BookingRowProps,
} from "../booking.types";
import { formatBookingDate } from "../booking-format";

export function BookingButton({ label, onPress, disabled, destructive }: BookingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-xl px-4 py-3 ${disabled ? "bg-slate-700" : destructive ? "bg-rose-700" : "bg-emerald-700"}`}
    >
      <Text className="text-center font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function BookingPanel({ children }: BookingPanelProps) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4">{children}</View>
  );
}

export function BookingRow({ label, value }: BookingRowProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-slate-300">{label}</Text>
      <Text className="text-base font-medium text-white">{value}</Text>
    </View>
  );
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={BOOKING_MESSAGES.openBooking(booking.bookingCode)}
      onPress={onPress}
      className="min-h-12 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4"
    >
      <Text className="text-lg font-bold text-white">{booking.bookingCode}</Text>
      <Text className="font-semibold text-emerald-300">
        {BOOKING_MESSAGES.status[booking.status] ?? booking.status}
      </Text>
      <Text className="text-base text-white">{booking.facility.name}</Text>
      <Text className="text-slate-300">
        {booking.unitType.name} · {booking.unitType.sizeLabel}
      </Text>
      <BookingRow label={BOOKING_MESSAGES.checkInAt} value={formatBookingDate(booking.checkInAt)} />
    </Pressable>
  );
}
