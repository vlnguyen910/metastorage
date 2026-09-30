import type { ReservationDraftInput } from "@metastorage/contracts";
import { ReservationDraftInputSchema } from "@metastorage/contracts";
import { z } from "zod";

export const createReservationDraftBodySchema = ReservationDraftInputSchema;
export type CreateReservationDraftBody = ReservationDraftInput;

export const reservationDraftIdParamSchema = z.object({
  draftId: z.string().uuid(),
});

export const createReservationHoldBodySchema = z.object({
  draftAccessToken: z.string().min(32),
});
export type CreateReservationHoldBody = z.infer<typeof createReservationHoldBodySchema>;
