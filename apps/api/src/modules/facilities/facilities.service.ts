import type { ApiFacility, ApiFacilityAssignment } from "@metastorage/contracts";
import type { Role } from "@metastorage/database";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/app-error";
import type { UsersRepository } from "../users/users.repository";
import type { FacilityListScope, FacilityScope } from "./facilities.access";
import { toApiFacility, toApiFacilityAssignment } from "./facilities.mapper";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilitiesRepository } from "./facilities.repository";
import type {
  CreateAssignmentBody,
  CreateFacilityBody,
  UpdateFacilityBody,
} from "./facilities.schema";

export class FacilitiesService {
  constructor(
    private readonly facilitiesRepository: FacilitiesRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async createFacility(input: CreateFacilityBody): Promise<ApiFacility> {
    const existing = await this.facilitiesRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictError(FACILITY_MESSAGES.facilityCodeAlreadyExists(input.code));
    }

    const facility = await this.facilitiesRepository.createFacility({
      code: input.code,
      name: input.name,
      address: input.address,
      description: input.description,
      isActive: input.isActive ?? true,
    });

    return toApiFacility(facility);
  }

  async getFacilityById(id: string, scope: FacilityScope): Promise<ApiFacility> {
    const facility = await this.facilitiesRepository.findAccessibleById(id, scope);
    if (!facility) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }
    return toApiFacility(facility);
  }

  async listFacilities(
    limit: number,
    offset: number,
    isActive: boolean | undefined,
    scope: FacilityListScope,
  ): Promise<ApiFacility[]> {
    const list = await this.facilitiesRepository.listAccessible(limit, offset, isActive, scope);
    return list.map(toApiFacility);
  }

  async updateFacility(
    id: string,
    input: UpdateFacilityBody,
    scope: FacilityScope,
  ): Promise<ApiFacility> {
    this.assertManagerScope(scope);
    const existing = await this.facilitiesRepository.findAccessibleById(id, scope);
    if (!existing) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }

    if (input.code && input.code !== existing.code) {
      const codeDuplicate = await this.facilitiesRepository.findByCode(input.code);
      if (codeDuplicate) {
        throw new ConflictError(FACILITY_MESSAGES.facilityCodeAlreadyExists(input.code));
      }
    }

    const updated = await this.facilitiesRepository.updateAccessible(id, input, scope);
    if (!updated) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }
    return toApiFacility(updated);
  }

  async assignUserToFacility(
    facilityId: string,
    input: CreateAssignmentBody,
  ): Promise<ApiFacilityAssignment> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility) {
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(facilityId));
    }

    const user = await this.usersRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError(FACILITY_MESSAGES.userNotFound(input.userId));
    }

    if (user.status !== "ACTIVE") {
      throw new BadRequestError(FACILITY_MESSAGES.inactiveUserAssignment);
    }

    if (user.role !== input.role) {
      throw new BadRequestError(FACILITY_MESSAGES.assignmentRoleMismatch);
    }

    const assignment = await this.facilitiesRepository.upsertAssignment({
      facilityId,
      userId: input.userId,
      role: input.role,
      isActive: true,
    });

    return toApiFacilityAssignment(assignment, {
      userName: user.name,
      userEmail: user.email,
      facilityName: facility.name,
      facilityCode: facility.code,
    });
  }

  async revokeAssignment(facilityId: string, userId: string): Promise<ApiFacilityAssignment> {
    const existing = await this.facilitiesRepository.findAssignment(facilityId, userId);
    if (!existing) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    const deactivated = await this.facilitiesRepository.deactivateAssignment(facilityId, userId);
    if (!deactivated) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    return toApiFacilityAssignment(deactivated);
  }

  async listFacilityAssignments(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ): Promise<ApiFacilityAssignment[]> {
    this.assertManagerScope(scope);
    const facility = await this.facilitiesRepository.findAccessibleById(facilityId, scope);
    if (!facility) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(facilityId));
    }

    const rows = await this.facilitiesRepository.listAssignmentsWithUsers(
      facilityId,
      limit,
      offset,
      scope,
    );
    return rows.map(({ assignment, userName, userEmail }) =>
      toApiFacilityAssignment(assignment, {
        userName,
        userEmail,
        facilityName: facility.name,
        facilityCode: facility.code,
      }),
    );
  }

  async listUserAssignments(
    userId: string,
    role: Role | null | undefined,
  ): Promise<ApiFacilityAssignment[]> {
    if (role !== "FACILITY_STAFF" && role !== "FACILITY_MANAGER") return [];
    const rows = await this.facilitiesRepository.listUserAssignmentsWithFacilities(userId, role);
    return rows.map(({ assignment, facilityName, facilityCode }) =>
      toApiFacilityAssignment(assignment, {
        facilityName,
        facilityCode,
      }),
    );
  }

  private assertManagerScope(scope: FacilityScope): void {
    if (scope.kind === "assigned" && scope.role !== "FACILITY_MANAGER") {
      throw new ForbiddenError(FACILITY_MESSAGES.facilityOperationDenied);
    }
  }
}
