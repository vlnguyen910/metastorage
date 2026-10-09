import {
  AssignPhysicalUnitBodySchema,
  AssignStaffBodySchema,
  BookingIdParamsSchema,
  BookingListQuerySchema,
  FacilityBookingsParamsSchema,
  StaffTasksQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnauthorizedError } from "../../common/errors/app-error";
import { successResponse } from "../../common/response/api-response";
import { requireAuth } from "../auth/auth.guard";
import { getFacilityAccessScope, requireAssignedFacility } from "../facilities/facilities.access";
import { requireFacilityAccess } from "../facilities/facilities.guard";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";

export const bookingsRoutes: FastifyPluginAsync = async (fastify) => {
  const bookingsRepository = new BookingsRepository(fastify.db);
  const assignmentsRepository = new FacilityAssignmentsRepository(fastify.db);
  const service = new BookingsService(bookingsRepository);

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/facilities/:facilityId/bookings - List bookings in facility (FM, Admin, BOM)
  typedApp.get(
    "/facilities/:facilityId/bookings",
    {
      schema: {
        params: FacilityBookingsParamsSchema,
        querystring: BookingListQuerySchema,
      },
      preHandler: [
        requireFacilityAccess({
          allowedFacilityRoles: ["FACILITY_MANAGER"],
        }),
      ],
    },
    async (request, reply) => {
      const { facilityId } = request.params;
      const { status } = request.query;
      const bookings = await service.getFacilityBookings(facilityId, status);
      return reply.status(200).send(successResponse(bookings));
    },
  );

  // GET /api/bookings/assigned-to-me - List bookings assigned to the current user
  typedApp.get(
    "/bookings/assigned-to-me",
    {
      schema: {
        querystring: StaffTasksQuerySchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const { facilityId } = request.query;
      const tasks = await service.getStaffTasks(user.id, facilityId);
      return reply.status(200).send(successResponse(tasks));
    },
  );

  // GET /api/bookings/:id - Get booking details
  typedApp.get(
    "/bookings/:id",
    {
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      // Verify facility scope access
      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
        "FACILITY_STAFF",
      ]);

      return reply.status(200).send(successResponse(booking));
    },
  );

  // GET /api/bookings/:id/eligible-units - Get list of physical units available for assignment
  typedApp.get(
    "/bookings/:id/eligible-units",
    {
      schema: {
        params: BookingIdParamsSchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const booking = await service.getBookingById(id);

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const units = await service.getEligibleUnits(id);
      return reply.status(200).send(successResponse(units));
    },
  );

  // POST /api/bookings/:id/assign-unit - Facility Manager manually assigns a physical unit
  typedApp.post(
    "/bookings/:id/assign-unit",
    {
      schema: {
        params: BookingIdParamsSchema,
        body: AssignPhysicalUnitBodySchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { physicalUnitId, reason } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const assignment = await service.assignPhysicalUnit(id, physicalUnitId, user.id, reason);
      return reply.status(200).send(successResponse(assignment));
    },
  );

  // POST /api/bookings/:id/assign-staff - Facility Manager assigns a staff member
  typedApp.post(
    "/bookings/:id/assign-staff",
    {
      schema: {
        params: BookingIdParamsSchema,
        body: AssignStaffBodySchema,
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { staffId } = request.body;

      const user = request.user;
      if (!user) throw new UnauthorizedError();
      const scope = getFacilityAccessScope(user);

      const booking = await service.getBookingById(id);
      await requireAssignedFacility(assignmentsRepository, booking.facilityId, scope, [
        "FACILITY_MANAGER",
      ]);

      const updatedBooking = await service.assignStaff(id, staffId);
      return reply.status(200).send(successResponse(updatedBooking));
    },
  );
};
