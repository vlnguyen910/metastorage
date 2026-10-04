import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { BackHandler, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../lib/auth-client";
import { BookingDetailScreen } from "../../screens/booking/booking-detail-screen";
import { BookingListScreen } from "../../screens/booking/booking-list-screen";
import { BOOKING_MESSAGES as M } from "./booking.messages";
import type { CustomerBookingsFlowProps } from "./booking.types";
import { BookingButton } from "./components/booking-ui";

export function CustomerBookingsFlow({ userId }: CustomerBookingsFlowProps) {
  // A per-session cache cannot expose a previous customer's booking data after sign-out.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!bookingId) return false;
      setBookingId(null);
      return true;
    });
    return () => listener.remove();
  }, [bookingId]);
  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw result.error;
      client.clear();
    } catch {
      setError(M.signOutFailed);
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <QueryClientProvider client={client}>
      <SafeAreaView className="flex-1 bg-slate-950">
        <StatusBar style="light" />
        <View className="border-b border-slate-700 px-5 py-3">
          <View className="mx-auto w-full max-w-xl">
            <BookingButton
              label={signingOut ? M.pending : M.signOut}
              disabled={signingOut}
              onPress={() => void signOut()}
            />
            {error ? (
              <Text accessibilityRole="alert" className="mt-2 text-rose-300">
                {error}
              </Text>
            ) : null}
          </View>
        </View>
        {bookingId ? (
          <BookingDetailScreen
            key={`${userId}-${bookingId}`}
            bookingId={bookingId}
            onBack={() => setBookingId(null)}
          />
        ) : (
          <BookingListScreen onSelect={setBookingId} />
        )}
      </SafeAreaView>
    </QueryClientProvider>
  );
}
