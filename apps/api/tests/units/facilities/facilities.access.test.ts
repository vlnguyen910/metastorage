import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Facility, FacilityAssignment } from "@metastorage/database";
import { BadRequestError, ForbiddenError } from "../../../src/common/errors/app-error";
import {
  getFacilityAccessScope,
  getFacilityListScope,
  requireAssignedFacility,
} from "../../../src/modules/facilities/facilities.access";
import type { FacilitiesRepository } from "../../../src/modules/facilities/facilities.repository";
import { FacilitiesService } from "../../../src/modules/facilities/facilities.service";
import type { UsersRepository } from "../../../src/modules/users/users.repository";

const now = new Date();
const assignedFacility = {
  id: "facility-a",
  code: "A",
  name: "Facility A",
  address: "A street",
  description: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
} as Facility;

const staffScope = {
  kind: "assigned" as const,
  userId: "staff-1",
  role: "FACILITY_STAFF" as const,
};

describe("facility access policy", () => {
  it("scopes facility staff listings to their own assignment", () => {
    assert.deepEqual(
      getFacilityListScope({ id: staffScope.userId, role: staffScope.role }),
      staffScope,
    );
    assert.deepEqual(getFacilityListScope({ id: "customer-1", role: "CUSTOMER" }), {
      kind: "public",
    });
  });

  it("rejects a customer from staff-only facility access", () => {
    assert.throws(
      () => getFacilityAccessScope({ id: "customer-1", role: "CUSTOMER" }),
      ForbiddenError,
    );
  });

  it("allows a matching active assignment and rejects a mismatched role", async () => {
    const assignment = {
      facilityId: assignedFacility.id,
      userId: staffScope.userId,
      role: "FACILITY_STAFF",
      isActive: true,
      endedAt: null,
    } as FacilityAssignment;
    const repository = {
      findActiveAssignment: async (_facilityId: string, _userId: string, role: string) =>
        role === assignment.role ? assignment : undefined,
    } as unknown as FacilitiesRepository;

    const scope = getFacilityAccessScope({ id: staffScope.userId, role: staffScope.role });
    assert.deepEqual(await requireAssignedFacility(repository, assignedFacility.id, scope), scope);
    await assert.rejects(
      () =>
        requireAssignedFacility(repository, assignedFacility.id, {
          kind: "assigned",
          userId: staffScope.userId,
          role: "FACILITY_MANAGER",
        }),
      ForbiddenError,
    );
  });

  it("rejects when no active assignment is found", async () => {
    const repository = {
      findActiveAssignment: async () => undefined,
    } as unknown as FacilitiesRepository;

    await assert.rejects(
      () => requireAssignedFacility(repository, assignedFacility.id, staffScope),
      ForbiddenError,
    );
  });
});

describe("facility scoped service", () => {
  it("lists only facilities returned by the scoped repository path", async () => {
    let receivedScope: unknown;
    const repository = {
      listAccessible: async (
        _limit: number,
        _offset: number,
        _isActive: boolean | undefined,
        scope: unknown,
      ) => {
        receivedScope = scope;
        return [assignedFacility];
      },
    } as unknown as FacilitiesRepository;
    const service = new FacilitiesService(repository, {} as UsersRepository);

    const result = await service.listFacilities(20, 0, undefined, staffScope);
    assert.deepEqual(
      result.map((facility) => facility.id),
      [assignedFacility.id],
    );
    assert.deepEqual(receivedScope, staffScope);
  });

  it("denies direct ID access outside the assignment at the service boundary", async () => {
    const repository = {
      findAccessibleById: async (id: string) =>
        id === assignedFacility.id ? assignedFacility : undefined,
    } as unknown as FacilitiesRepository;
    const service = new FacilitiesService(repository, {} as UsersRepository);

    assert.equal(
      (await service.getFacilityById(assignedFacility.id, staffScope)).id,
      assignedFacility.id,
    );
    await assert.rejects(() => service.getFacilityById("facility-b", staffScope), ForbiddenError);
  });

  it("denies a cross-facility update without writing", async () => {
    let wrote = false;
    const repository = {
      findAccessibleById: async () => undefined,
      updateAccessible: async () => {
        wrote = true;
        return assignedFacility;
      },
    } as unknown as FacilitiesRepository;
    const service = new FacilitiesService(repository, {} as UsersRepository);

    await assert.rejects(
      () =>
        service.updateFacility(
          "facility-b",
          { name: "Unauthorized" },
          {
            kind: "assigned",
            userId: "manager-1",
            role: "FACILITY_MANAGER",
          },
        ),
      ForbiddenError,
    );
    assert.equal(wrote, false);
  });

  it("does not show stale assignments after a user leaves a facility role", async () => {
    const repository = {} as FacilitiesRepository;
    const service = new FacilitiesService(repository, {} as UsersRepository);

    assert.deepEqual(await service.listUserAssignments(staffScope.userId, "CUSTOMER"), []);
  });

  it("rejects creating an assignment whose role differs from the account role", async () => {
    const repository = {
      findById: async () => assignedFacility,
    } as unknown as FacilitiesRepository;
    const usersRepository = {
      findById: async () => ({
        id: "staff-1",
        name: "Staff",
        email: "staff@example.com",
        status: "ACTIVE",
        role: "FACILITY_STAFF",
      }),
    } as unknown as UsersRepository;
    const service = new FacilitiesService(repository, usersRepository);

    await assert.rejects(
      () =>
        service.assignUserToFacility(assignedFacility.id, {
          userId: "staff-1",
          role: "FACILITY_MANAGER",
        }),
      BadRequestError,
    );
  });
});
