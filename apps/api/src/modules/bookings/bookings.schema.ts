import { BookingQrVerificationInputSchema } from "@storex/contracts";
import { z } from "zod";

export const VerifyQrBodySchema = BookingQrVerificationInputSchema;

export const FacilityBookingsParamsSchema = z.object({
  facilityId: z.string().uuid(),
});
export type FacilityBookingsParams = z.infer<typeof FacilityBookingsParamsSchema>;

export const BookingIdParamsSchema = z.object({
  id: z.string().uuid(),
});
export type BookingIdParams = z.infer<typeof BookingIdParamsSchema>;

export const AssignPhysicalUnitBodySchema = z.object({
  physicalUnitId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type AssignPhysicalUnitBody = z.infer<typeof AssignPhysicalUnitBodySchema>;

export const BookingListQuerySchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]).optional(),
});
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;
