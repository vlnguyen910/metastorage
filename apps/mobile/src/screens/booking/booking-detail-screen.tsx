import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { BOOKING_MESSAGES as M } from "../../features/bookings/booking.messages";
import type { BookingDetailScreenProps } from "../../features/bookings/booking.types";
import {
  bookingErrorMessage,
  formatBookingDate,
  formatBookingMoney,
} from "../../features/bookings/booking-format";
import { BookingActionDialog } from "../../features/bookings/components/booking-action-dialog";
import {
  BookingButton,
  BookingPanel,
  BookingRow,
} from "../../features/bookings/components/booking-ui";
import { useBookingDetail } from "../../features/bookings/hooks/use-bookings";

export function BookingDetailScreen({ bookingId, onBack }: BookingDetailScreenProps) {
  const query = useBookingDetail(bookingId);
  const booking = query.data;
  const [mode, setMode] = useState<"cancel" | "reschedule" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow p-5"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor="#34d399"
          />
        }
      >
        <View className="mx-auto w-full max-w-xl gap-5">
          <BookingButton label={M.back} onPress={onBack} />
          <Text accessibilityRole="header" className="text-2xl font-bold text-white">
            {M.detail}
          </Text>
          {query.isPending ? (
            <ActivityIndicator accessibilityLabel={M.loading} color="#34d399" />
          ) : null}
          {query.isError ? (
            <View className="gap-3">
              <Text accessibilityRole="alert" className="text-rose-300">
                {booking ? M.stale : bookingErrorMessage(query.error)}
              </Text>
              <BookingButton
                label={M.retry}
                disabled={query.isFetching}
                onPress={() => void query.refetch()}
              />
            </View>
          ) : null}
          {message ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="text-emerald-300"
            >
              {message}
            </Text>
          ) : null}
          {booking ? (
            <>
              <BookingPanel>
                <Text className="text-xl font-bold text-white">{booking.bookingCode}</Text>
                <Text className="text-base font-semibold text-emerald-300">
                  {M.status[booking.status] ?? booking.status}
                </Text>
                <BookingRow label={M.facility} value={booking.facility.name} />
                <BookingRow label={M.address} value={booking.facility.address} />
                <BookingRow
                  label={M.unitType}
                  value={`${booking.unitType.name} · ${booking.unitType.sizeLabel}`}
                />
                <BookingRow label={M.checkInAt} value={formatBookingDate(booking.checkInAt)} />
                <BookingRow label={M.slotEnd} value={formatBookingDate(booking.checkInSlotEnd)} />
                <BookingRow label={M.rentalEnd} value={formatBookingDate(booking.rentalEndAt)} />
                <BookingRow label={M.duration} value={M.months(booking.durationMonths)} />
              </BookingPanel>
              <BookingPanel>
                <BookingRow
                  label={M.rentalFee}
                  value={formatBookingMoney(
                    booking.pricing.rentalFeeAmount,
                    booking.pricing.currency,
                  )}
                />
                <BookingRow
                  label={M.deposit}
                  value={formatBookingMoney(
                    booking.pricing.depositAmount,
                    booking.pricing.currency,
                  )}
                />
                <BookingRow
                  label={M.total}
                  value={formatBookingMoney(booking.pricing.totalAmount, booking.pricing.currency)}
                />
              </BookingPanel>
              <BookingPanel>
                <Text className="text-base leading-6 text-slate-200">{M.reschedulePolicy}</Text>
                <Text className="text-emerald-300">
                  {M.rescheduleCount(booking.rescheduleCount)}
                </Text>
                {booking.actions.reasonCodes.map((reason) => (
                  <Text key={reason} className="text-amber-200">
                    {M.reasons[reason] ?? M.unavailable}
                  </Text>
                ))}
                <BookingButton
                  label={M.reschedule}
                  disabled={!booking.actions.canReschedule || query.isError || query.isFetching}
                  onPress={() => {
                    setMessage(null);
                    setMode("reschedule");
                  }}
                />
                <BookingButton
                  label={M.cancel}
                  destructive
                  disabled={!booking.actions.canCancel || query.isError || query.isFetching}
                  onPress={() => {
                    setMessage(null);
                    setMode("cancel");
                  }}
                />
              </BookingPanel>
              <BookingPanel>
                <Text accessibilityRole="header" className="text-xl font-bold text-white">
                  {M.refund}
                </Text>
                {booking.refund ? (
                  <>
                    <BookingRow label={M.refundStatus} value={booking.refund.status} />
                    <BookingRow
                      label={M.refundAmount}
                      value={formatBookingMoney(booking.refund.amount, booking.refund.currency)}
                    />
                    <BookingRow
                      label={M.forfeitedDeposit}
                      value={formatBookingMoney(
                        booking.refund.forfeitedDepositAmount,
                        booking.refund.currency,
                      )}
                    />
                    <Text className="text-base leading-6 text-amber-200">
                      {booking.refund.simulation ? M.simulated : M.realRefund}
                    </Text>
                  </>
                ) : (
                  <Text className="text-slate-300">{M.noRefund}</Text>
                )}
              </BookingPanel>
              <BookingPanel>
                <Text accessibilityRole="header" className="text-xl font-bold text-white">
                  {M.history}
                </Text>
                {booking.history.length === 0 ? (
                  <Text className="text-slate-300">{M.noHistory}</Text>
                ) : null}
                {booking.history.map((event) => (
                  <View
                    key={`${event.at}-${event.action}-${event.newCheckInAt}`}
                    className="gap-2 border-t border-slate-700 pt-3"
                  >
                    <Text className="font-semibold text-white">
                      {M.historyActions[event.action] ?? event.action}
                    </Text>
                    <Text className="text-slate-300">{formatBookingDate(event.at)}</Text>
                    {event.previousCheckInAt ? (
                      <Text className="text-slate-300">
                        {formatBookingDate(event.previousCheckInAt)} →{" "}
                        {formatBookingDate(event.newCheckInAt)}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </BookingPanel>
            </>
          ) : null}
        </View>
      </ScrollView>
      {booking ? (
        <BookingActionDialog
          booking={booking}
          mode={mode}
          onClose={() => setMode(null)}
          onSuccess={setMessage}
        />
      ) : null}
    </>
  );
}
