import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { UsersRepository } from "../users/users.repository";
import { getFacilityContext, requireFacilityAccess } from "./facilities.guard";
import { FacilitiesRepository } from "./facilities.repository";
import {
  createFacilityBodySchema,
  facilityIdParamSchema,
  facilityQuerySchema,
  updateFacilityBodySchema,
} from "./facilities.schema";
import { FacilitiesService } from "./facilities.service";

export const facilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const facilitiesRepository = new FacilitiesRepository(fastify.db);
  const usersRepository = new UsersRepository(fastify.db);
  const service = new FacilitiesService(facilitiesRepository, usersRepository);

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /api/facilities - Create new facility (Admin & BOM)
  typedApp.post(
    "/",
    {
      schema: {
        body: createFacilityBodySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER")],
    },
    async (request, reply) => {
      const facility = await service.createFacility(request.body);
      return reply.status(201).send(successResponse(facility));
    },
  );

  // GET /api/facilities - List facilities
  typedApp.get(
    "/",
    {
      schema: {
        querystring: facilityQuerySchema,
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const facilities = await service.getAllActiveFacilities(limit, offset);
      return reply.status(200).send(successResponse(facilities));
    },
  );


  // GET /api/facilities/:id - Get facility by ID (Admin, BOM, or assigned staff/manager)
  typedApp.get(
    "/:id",
    {
      schema: {
        params: facilityIdParamSchema,
      },
      preHandler: [requireFacilityAccess()],
    },
    async (request, reply) => {
      const { id } = request.params;
      const facility = await service.getFacilityById(id, getFacilityContext(request).scope);
      return reply.status(200).send(successResponse(facility));
    },
  );

  // PATCH /api/facilities/:id - Update facility (Admin, BOM, or Facility Manager of this facility)
  typedApp.patch(
    "/:id",
    {
      schema: {
        params: facilityIdParamSchema,
        body: updateFacilityBodySchema,
      },
      preHandler: [requireFacilityAccess({ allowedFacilityRoles: ["FACILITY_MANAGER"] })],
    },
    async (request, reply) => {
      const { id } = request.params;
      const updated = await service.updateFacility(
        id,
        request.body,
        getFacilityContext(request).scope,
      );
      return reply.status(200).send(successResponse(updated));
    },
  );
};
