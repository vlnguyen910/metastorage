import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { PaymentsRepository } from "./payments.repository";
import {
  type CheckoutPaymentBody,
  checkoutPaymentBodySchema,
  paymentDraftIdParamSchema,
} from "./payments.schema";
import { PaymentsService } from "./payments.service";

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new PaymentsService(new PaymentsRepository(fastify.db));
  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/reservations/drafts/:draftId/pay",
    { schema: { params: paymentDraftIdParamSchema, body: checkoutPaymentBodySchema } },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          successResponse(
            await service.pay(request.params.draftId, request.body as CheckoutPaymentBody),
          ),
        ),
  );
};
