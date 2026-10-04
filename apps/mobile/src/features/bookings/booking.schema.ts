import { z } from "zod";
import { BOOKING_MESSAGES } from "./booking.messages";

export function toCheckInAt(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

export const rescheduleFormSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, BOOKING_MESSAGES.invalidDate)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, BOOKING_MESSAGES.invalidDate),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, BOOKING_MESSAGES.invalidTime),
  })
  .superRefine((value, context) => {
    const timestamp = Date.parse(`${value.date}T${value.time}:00+07:00`);
    if (Number.isFinite(timestamp) && timestamp <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: BOOKING_MESSAGES.futureDate,
      });
    }
  });

export type RescheduleFormValues = z.infer<typeof rescheduleFormSchema>;
