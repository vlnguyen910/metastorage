import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { CheckInSlotsRepository } from "../bookings/check-in-slots.repository";
import { CheckInSlotsService } from "../bookings/check-in-slots.service";
import { ReservationsRepository } from "./reservations.repository";
import {
  type CreateReservationDraftBody,
  createReservationDraftBodySchema,
  createReservationHoldBodySchema,
  reservationDraftIdParamSchema,
} from "./reservations.schema";
import { ReservationsService } from "./reservations.service";

export const reservationsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ReservationsService(
    new ReservationsRepository(fastify.db),
    new CheckInSlotsService(new CheckInSlotsRepository(fastify.db)),
  );
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/drafts",
    { schema: { body: createReservationDraftBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(await service.createDraft(request.body as CreateReservationDraftBody)),
        ),
  );

  typedApp.post(
    "/drafts/:draftId/hold",
    {
      schema: {
        params: reservationDraftIdParamSchema,
        body: createReservationHoldBodySchema,
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.createHold(
              (request.params as { draftId: string }).draftId,
              (request.body as { draftAccessToken: string }).draftAccessToken,
            ),
          ),
        ),
  );
};
