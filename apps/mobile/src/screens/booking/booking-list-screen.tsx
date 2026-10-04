import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { BOOKING_MESSAGES as M } from "../../features/bookings/booking.messages";
import type { BookingListScreenProps } from "../../features/bookings/booking.types";
import { bookingErrorMessage } from "../../features/bookings/booking-format";
import { BookingButton, BookingCard } from "../../features/bookings/components/booking-ui";
import { useBookings } from "../../features/bookings/hooks/use-bookings";

export function BookingListScreen({ onSelect }: BookingListScreenProps) {
  const query = useBookings();
  return (
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
      <View className="mx-auto w-full max-w-xl gap-4">
        <Text accessibilityRole="header" className="text-2xl font-bold text-white">
          {M.title}
        </Text>
        {query.isPending ? (
          <ActivityIndicator accessibilityLabel={M.loading} color="#34d399" />
        ) : null}
        {query.isError ? (
          <View className="gap-3">
            <Text accessibilityRole="alert" className="text-rose-300">
              {bookingErrorMessage(query.error)}
            </Text>
            <BookingButton
              label={M.retry}
              disabled={query.isFetching}
              onPress={() => void query.refetch()}
            />
          </View>
        ) : null}
        {query.data?.length === 0 ? (
          <Text className="text-base text-slate-300">{M.empty}</Text>
        ) : null}
        {query.data?.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onPress={() => onSelect(booking.id)} />
        ))}
      </View>
    </ScrollView>
  );
}
