import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BOOKING_MESSAGES as M } from "../booking.messages";
import { type RescheduleFormValues, rescheduleFormSchema, toCheckInAt } from "../booking.schema";
import type { BookingDialogProps } from "../booking.types";
import { bookingErrorMessage, formatBookingMoney } from "../booking-format";
import { useBookingActions } from "../hooks/use-booking-actions";
import { BookingButton, BookingRow } from "./booking-ui";

export function BookingActionDialog({ booking, mode, onClose, onSuccess }: BookingDialogProps) {
  const actions = useBookingActions(booking.id);
  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: { date: "", time: "" },
  });
  const { reset } = form;
  const { reset: resetCancel } = actions.cancel;
  const { reset: resetReschedule } = actions.reschedule;
  useEffect(() => {
    if (mode) {
      reset({ date: "", time: "" });
      resetCancel();
      resetReschedule();
    }
  }, [mode, reset, resetCancel, resetReschedule]);

  const allowed = mode === "cancel" ? booking.actions.canCancel : booking.actions.canReschedule;
  const error = mode === "cancel" ? actions.cancel.error : actions.reschedule.error;
  const close = () => {
    if (!actions.isPending) onClose();
  };
  const cancel = () => {
    if (!allowed || actions.isPending) return;
    actions.cancel.mutate(undefined, {
      onSuccess: () => {
        onSuccess(M.cancelled);
        onClose();
      },
    });
  };
  const reschedule = form.handleSubmit((values) => {
    if (!allowed || actions.isPending) return;
    actions.reschedule.mutate(toCheckInAt(values.date, values.time), {
      onSuccess: () => {
        onSuccess(M.rescheduled);
        onClose();
      },
    });
  });

  return (
    <Modal visible={mode !== null} animationType="slide" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-slate-950">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow p-5">
            <View accessibilityViewIsModal className="mx-auto w-full max-w-xl gap-5">
              <Text accessibilityRole="header" className="text-2xl font-bold text-white">
                {mode === "cancel" ? M.cancelTitle : M.reschedule}
              </Text>
              <Text className="text-lg font-semibold text-emerald-300">{booking.bookingCode}</Text>
              {mode === "cancel" ? (
                <>
                  <Text className="text-base leading-6 text-slate-200">{M.cancelPolicy}</Text>
                  <BookingRow
                    label={M.refundAmount}
                    value={formatBookingMoney(
                      booking.pricing.rentalFeeAmount,
                      booking.pricing.currency,
                    )}
                  />
                  <BookingRow
                    label={M.forfeitedDeposit}
                    value={formatBookingMoney(
                      booking.pricing.depositAmount,
                      booking.pricing.currency,
                    )}
                  />
                  <Text className="text-base leading-6 text-amber-200">{M.simulated}</Text>
                  <Text className="text-slate-300">{M.refundProcessing}</Text>
                </>
              ) : (
                <>
                  <Text className="text-base leading-6 text-slate-200">{M.reschedulePolicy}</Text>
                  <Text className="text-emerald-300">
                    {M.rescheduleCount(booking.rescheduleCount)}
                  </Text>
                  <View className="gap-2">
                    <Text className="font-semibold text-white">{M.date}</Text>
                    <Controller
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <TextInput
                          accessibilityLabel={M.date}
                          accessibilityHint={form.formState.errors.date?.message}
                          className="min-h-12 rounded-xl border border-slate-500 bg-slate-900 px-3 text-base text-white"
                          editable={!actions.isPending}
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          returnKeyType="next"
                          onSubmitEditing={() => form.setFocus("time")}
                        />
                      )}
                    />
                    {form.formState.errors.date ? (
                      <Text accessibilityRole="alert" className="text-rose-300">
                        {form.formState.errors.date.message}
                      </Text>
                    ) : null}
                  </View>
                  <View className="gap-2">
                    <Text className="font-semibold text-white">{M.time}</Text>
                    <Controller
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <TextInput
                          accessibilityLabel={M.time}
                          accessibilityHint={form.formState.errors.time?.message}
                          className="min-h-12 rounded-xl border border-slate-500 bg-slate-900 px-3 text-base text-white"
                          editable={!actions.isPending}
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          returnKeyType="done"
                          onSubmitEditing={() => void reschedule()}
                        />
                      )}
                    />
                    {form.formState.errors.time ? (
                      <Text accessibilityRole="alert" className="text-rose-300">
                        {form.formState.errors.time.message}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
              {!allowed ? (
                <Text accessibilityRole="alert" className="text-amber-200">
                  {M.unavailable}
                </Text>
              ) : null}
              {error ? (
                <Text accessibilityRole="alert" className="text-rose-300">
                  {bookingErrorMessage(error)}
                </Text>
              ) : null}
              <BookingButton
                label={actions.isPending ? M.pending : mode === "cancel" ? M.confirmCancel : M.save}
                destructive={mode === "cancel"}
                disabled={!allowed || actions.isPending}
                onPress={mode === "cancel" ? cancel : () => void reschedule()}
              />
              <BookingButton
                label={mode === "cancel" ? M.keepBooking : M.close}
                disabled={actions.isPending}
                onPress={close}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
