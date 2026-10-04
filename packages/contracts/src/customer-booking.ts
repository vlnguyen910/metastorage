import { z } from "zod";
import { CUSTOMER_BOOKING_MESSAGES } from "./customer-booking.messages";

const timestamp = z.string().datetime({ offset: true });
const amount = z.string().regex(/^\d+(\.\d+)?$/);
export const CustomerBookingSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  facility: z.object({ id: z.string().uuid(), name: z.string(), address: z.string() }),
  unitType: z.object({ id: z.string().uuid(), name: z.string(), sizeLabel: z.string() }),
  checkInAt: timestamp,
  checkInSlotEnd: timestamp.nullable(),
  rentalEndAt: timestamp,
  durationMonths: z.number().int().positive(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  rescheduleCount: z.number().int().nonnegative(),
  pricing: z.object({
    rentalFeeAmount: amount,
    depositAmount: amount,
    totalAmount: amount,
    currency: z.string().length(3),
  }),
  history: z.array(
    z.object({
      action: z.enum(["CANCELLED", "RESCHEDULED", "NO_SHOW"]),
      at: timestamp,
      previousCheckInAt: timestamp.nullable(),
      newCheckInAt: timestamp.nullable(),
    }),
  ),
  refund: z
    .object({
      status: z.enum(["PENDING", "SUCCEEDED", "FAILED"]),
      amount,
      forfeitedDepositAmount: amount,
      currency: z.string().length(3),
      simulation: z.boolean(),
    })
    .nullable(),
  actions: z.object({
    canCancel: z.boolean(),
    canReschedule: z.boolean(),
    reasonCodes: z.array(z.string()),
  }),
});
export type CustomerBooking = z.infer<typeof CustomerBookingSchema>;
export const CancelBookingInputSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(1, CUSTOMER_BOOKING_MESSAGES.idempotencyKeyRequired)
      .max(128),
  })
  .strict();
export const RescheduleBookingInputSchema = CancelBookingInputSchema.extend({
  checkInAt: z
    .string()
    .datetime({ offset: true, message: CUSTOMER_BOOKING_MESSAGES.invalidCheckInAt }),
}).strict();
export type CancelBookingInput = z.infer<typeof CancelBookingInputSchema>;
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingInputSchema>;
export const BookingCancelInputSchema = CancelBookingInputSchema;
export const BookingRescheduleInputSchema = RescheduleBookingInputSchema;
export type BookingCancelInput = CancelBookingInput;
export type BookingRescheduleInput = RescheduleBookingInput;
