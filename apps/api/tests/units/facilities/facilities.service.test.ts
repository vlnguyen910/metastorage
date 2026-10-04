import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewFacilityAssignment } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../../src/common/errors/app-error";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import { FacilitiesService } from "../../../src/modules/facilities/facilities.service";
import type { UsersRepository } from "../../../src/modules/users/users.repository";

describe("facilities service", () => {
  it("throws ConflictError when creating a facility with existing code", async () => {
    const mockFacilitiesRepo = {
      findByCode: async (code: string) => ({
        id: "1",
        code,
        name: "Test",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {} as UsersRepository;
    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () =>
        service.createFacility({
          code: "EXISTING",
          name: "Test Facility",
          address: "123 Street",
        }),
      ConflictError,
    );
  });

  it("throws NotFoundError when facility does not exist", async () => {
    const mockFacilitiesRepo = {
      findAccessibleById: async () => undefined,
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {} as UsersRepository;
    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () =>
        service.getFacilityById("00000000-0000-0000-0000-000000000000", {
          kind: "global",
          userId: "admin-1",
          role: "SYSTEM_ADMIN",
        }),
      NotFoundError,
    );
  });

  it("throws BadRequestError when assigning an inactive user to facility", async () => {
    const mockFacilitiesRepo = {
      findById: async () => ({
        id: "f1",
        code: "F1",
        name: "Facility 1",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {
      findById: async () => ({
        id: "u1",
        name: "User Inactive",
        email: "inactive@metastorage.test",
        status: "INACTIVE" as const,
        role: "FACILITY_STAFF" as const,
        emailVerified: true,
        image: null,
        phone: null,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as UsersRepository;

    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    await assert.rejects(
      () =>
        service.assignUserToFacility("f1", {
          userId: "u1",
          role: "FACILITY_STAFF",
        }),
      BadRequestError,
    );
  });

  it("successfully assigns active user to facility", async () => {
    const now = new Date();
    const mockFacilitiesRepo = {
      findById: async () => ({
        id: "f1",
        code: "F1",
        name: "Facility 1",
        address: "Address",
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
      upsertAssignment: async (data: NewFacilityAssignment) => ({
        id: "a1",
        facilityId: data.facilityId,
        userId: data.userId,
        role: data.role,
        isActive: true,
        assignedAt: now,
        endedAt: null,
      }),
    } as unknown as FacilitiesRepository;

    const mockUsersRepo = {
      findById: async () => ({
        id: "u1",
        name: "User Active",
        email: "active@metastorage.test",
        status: "ACTIVE" as const,
        role: "FACILITY_STAFF" as const,
        emailVerified: true,
        image: null,
        phone: null,
        passwordHash: null,
        createdAt: now,
        updatedAt: now,
      }),
    } as unknown as UsersRepository;

    const service = new FacilitiesService(mockFacilitiesRepo, mockUsersRepo);

    const result = await service.assignUserToFacility("f1", {
      userId: "u1",
      role: "FACILITY_STAFF",
    });

    assert.equal(result.facilityId, "f1");
    assert.equal(result.userId, "u1");
    assert.equal(result.role, "FACILITY_STAFF");
    assert.equal(result.userName, "User Active");
    assert.equal(result.facilityCode, "F1");
  });

  describe("physical unit tracking & status transitions", () => {
    const now = new Date();
    const facilityId = "11111111-1111-1111-1111-111111111111";
    const unitId = "22222222-2222-2222-2222-222222222222";
    const unitTypeId = "33333333-3333-3333-3333-333333333333";

    it("lists physical units for assigned facility manager", async () => {
      const mockFacilitiesRepo = {
        findAccessibleById: async () => ({
          id: facilityId,
          code: "FAC-1",
          name: "Facility 1",
          address: "123 Street",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
        listFacilityUnits: async () => [
          {
            unit: {
              id: unitId,
              facilityId,
              unitTypeId,
              code: "U-101",
              floor: "1",
              locationDescription: "Aisle A",
              status: "AVAILABLE",
              createdAt: now,
              updatedAt: now,
            },
            unitTypeName: "Small Locker",
            unitTypeSize: 2,
            monthlyPrice: 500000,
            currentBookingId: null,
            currentBookingCode: null,
          },
        ],
      } as unknown as FacilitiesRepository;

      const service = new FacilitiesService(mockFacilitiesRepo, {} as UsersRepository);

      const result = await service.listFacilityUnits(
        facilityId,
        {},
        {
          kind: "assigned",
          userId: "fm-1",
          role: "FACILITY_MANAGER",
        },
      );

      assert.equal(result.length, 1);
      assert.equal(result[0]?.code, "U-101");
      assert.equal(result[0]?.status, "AVAILABLE");
      assert.equal(result[0]?.unitTypeName, "Small Locker");
    });

    it("successfully transitions unit from AVAILABLE to MAINTENANCE", async () => {
      const mockFacilitiesRepo = {
        findAccessibleById: async () => ({
          id: facilityId,
          code: "FAC-1",
          name: "Facility 1",
          address: "123 Street",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
        findUnitWithDetailsById: async () => ({
          unit: {
            id: unitId,
            facilityId,
            unitTypeId,
            code: "U-101",
            floor: "1",
            locationDescription: "Aisle A",
            status: "AVAILABLE",
            createdAt: now,
            updatedAt: now,
          },
          unitTypeName: "Small Locker",
          unitTypeSize: 2,
          monthlyPrice: 500000,
        }),
        hasActiveAssignmentOrRental: async () => false,
        updateUnitStatus: async (_uId: string, status: string) => ({
          id: unitId,
          facilityId,
          unitTypeId,
          code: "U-101",
          floor: "1",
          locationDescription: "Aisle A",
          status,
          createdAt: now,
          updatedAt: now,
        }),
      } as unknown as FacilitiesRepository;

      const service = new FacilitiesService(mockFacilitiesRepo, {} as UsersRepository);

      const result = await service.updateUnitStatus(
        facilityId,
        unitId,
        { status: "MAINTENANCE", notes: "Broken door hinge" },
        { kind: "assigned", userId: "fm-1", role: "FACILITY_MANAGER" },
      );

      assert.equal(result.status, "MAINTENANCE");
      assert.equal(result.code, "U-101");
    });

    it("rejects invalid status transition from AVAILABLE to RESERVED", async () => {
      const mockFacilitiesRepo = {
        findAccessibleById: async () => ({
          id: facilityId,
          code: "FAC-1",
          name: "Facility 1",
          address: "123 Street",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
        findUnitWithDetailsById: async () => ({
          unit: {
            id: unitId,
            facilityId,
            unitTypeId,
            code: "U-101",
            floor: "1",
            locationDescription: "Aisle A",
            status: "AVAILABLE",
            createdAt: now,
            updatedAt: now,
          },
          unitTypeName: "Small Locker",
          unitTypeSize: 2,
          monthlyPrice: 500000,
        }),
        hasActiveAssignmentOrRental: async () => false,
      } as unknown as FacilitiesRepository;

      const service = new FacilitiesService(mockFacilitiesRepo, {} as UsersRepository);

      await assert.rejects(
        () =>
          service.updateUnitStatus(
            facilityId,
            unitId,
            { status: "RESERVED" },
            { kind: "assigned", userId: "fm-1", role: "FACILITY_MANAGER" },
          ),
        BadRequestError,
      );
    });

    it("rejects transition when unit has active assignment or rental (In Use)", async () => {
      const mockFacilitiesRepo = {
        findAccessibleById: async () => ({
          id: facilityId,
          code: "FAC-1",
          name: "Facility 1",
          address: "123 Street",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
        findUnitWithDetailsById: async () => ({
          unit: {
            id: unitId,
            facilityId,
            unitTypeId,
            code: "U-101",
            floor: "1",
            locationDescription: "Aisle A",
            status: "AVAILABLE",
            createdAt: now,
            updatedAt: now,
          },
          unitTypeName: "Small Locker",
          unitTypeSize: 2,
          monthlyPrice: 500000,
        }),
        hasActiveAssignmentOrRental: async () => true,
      } as unknown as FacilitiesRepository;

      const service = new FacilitiesService(mockFacilitiesRepo, {} as UsersRepository);

      await assert.rejects(
        () =>
          service.updateUnitStatus(
            facilityId,
            unitId,
            { status: "MAINTENANCE" },
            { kind: "assigned", userId: "fm-1", role: "FACILITY_MANAGER" },
          ),
        ConflictError,
      );
    });

    it("rejects unit update if unit does not belong to facility", async () => {
      const mockFacilitiesRepo = {
        findAccessibleById: async () => ({
          id: facilityId,
          code: "FAC-1",
          name: "Facility 1",
          address: "123 Street",
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
        findUnitWithDetailsById: async () => ({
          unit: {
            id: unitId,
            facilityId: "99999999-9999-9999-9999-999999999999", // Different facility
            unitTypeId,
            code: "U-101",
            floor: "1",
            locationDescription: "Aisle A",
            status: "AVAILABLE",
            createdAt: now,
            updatedAt: now,
          },
          unitTypeName: "Small Locker",
          unitTypeSize: 2,
          monthlyPrice: 500000,
        }),
        hasActiveAssignmentOrRental: async () => false,
      } as unknown as FacilitiesRepository;

      const service = new FacilitiesService(mockFacilitiesRepo, {} as UsersRepository);

      await assert.rejects(
        () =>
          service.updateUnitStatus(
            facilityId,
            unitId,
            { status: "MAINTENANCE" },
            { kind: "assigned", userId: "fm-1", role: "FACILITY_MANAGER" },
          ),
        BadRequestError,
      );
    });
  });
});
