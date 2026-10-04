import { BookingCancelInputSchema, BookingRescheduleInputSchema } from "@metastorage/contracts";
import { BookingLifecycleRepository } from "@metastorage/database";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { BookingIdParamsSchema } from "./bookings.schema";
import { CustomerBookingsService } from "./customer-bookings.service";

function customerUserId(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user.id;
}
export const customerBookingsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new CustomerBookingsService(new BookingLifecycleRepository(fastify.db));
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const preHandler = [requireRole("CUSTOMER")];
  app.get("/bookings/mine", { preHandler }, async (request) =>
    successResponse(await service.mine(customerUserId(request))),
  );
  app.post(
    "/bookings/:id/cancel",
    { preHandler, schema: { params: BookingIdParamsSchema, body: BookingCancelInputSchema } },
    async (request) =>
      successResponse(
        await service.mutate(customerUserId(request), request.params.id, "CANCELLED", request.body),
      ),
  );
  app.post(
    "/bookings/:id/reschedule",
    { preHandler, schema: { params: BookingIdParamsSchema, body: BookingRescheduleInputSchema } },
    async (request) =>
      successResponse(
        await service.mutate(
          customerUserId(request),
          request.params.id,
          "RESCHEDULED",
          request.body,
        ),
      ),
  );
};
