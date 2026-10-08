import {
  createFacilityBodySchema,
  facilityIdNestedParamSchema,
  facilityQuerySchema,
  UnitTypeListQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireRole } from "../auth/auth.guard";
import { UnitTypesRepository } from "../unit-types/unit-types.repository";
import { UnitTypesService } from "../unit-types/unit-types.service";
import { FacilitiesRepository } from "./facilities.repository";
import { FacilitiesService } from "./facilities.service";

export const facilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const facilitiesRepository = new FacilitiesRepository(fastify.db);
  const service = new FacilitiesService(facilitiesRepository);
  const unitTypesService = new UnitTypesService(
    new UnitTypesRepository(fastify.db),
    facilitiesRepository,
  );

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

  typedApp.get(
    "/:facilityId/unit-types",
    {
      schema: {
        params: facilityIdNestedParamSchema,
        querystring: UnitTypeListQuerySchema,
      },
    },
    async (request, reply) => {
      const unitTypes = await unitTypesService.listByFacility(
        request.params.facilityId,
        request.query,
      );
      return reply.status(200).send(successResponse(unitTypes));
    },
  );
};
