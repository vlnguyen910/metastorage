import type { CreateFacilityBody, UpdateFacilityBody } from "@metastorage/contracts";
import type { Facility, FacilityAssignment, Role } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { FacilityListScope, FacilityScope } from "./facilities.access";
import { FACILITY_MESSAGES } from "./facilities.messages";
import type { FacilitiesRepository } from "./facilities.repository";

export class FacilitiesService {
  constructor(private readonly facilitiesRepository: FacilitiesRepository) {}

  async createFacility(input: CreateFacilityBody): Promise<Facility> {
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

    return facility;
  }

  async getFacilityById(id: string, scope: FacilityScope): Promise<Facility> {
    const facility = await this.facilitiesRepository.findAccessibleById(id, scope);
    if (!facility) {
      if (scope.kind === "assigned")
        throw new ForbiddenError(FACILITY_MESSAGES.facilityAccessDenied);
      throw new NotFoundError(FACILITY_MESSAGES.facilityNotFound(id));
    }
    return facility;
  }

  async listFacilities(
    limit: number,
    offset: number,
    isActive: boolean | undefined,
    scope: FacilityListScope,
  ): Promise<Facility[]> {
    const list = await this.facilitiesRepository.listAccessible(limit, offset, isActive, scope);
    return list;
  }

  async getAllActiveFacilities(limit: number, offset: number): Promise<Facility[]> {
    const isActive: boolean = true;
    const list = await this.facilitiesRepository.getAllFacilities(limit, offset, isActive);
    return list;
  }

  async updateFacility(
    id: string,
    input: UpdateFacilityBody,
    scope: FacilityScope,
  ): Promise<Facility> {
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
    return updated;
  }

  async revokeAssignment(facilityId: string, userId: string): Promise<FacilityAssignment> {
    const existing = await this.facilitiesRepository.findAssignment(facilityId, userId);
    if (!existing) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    const deactivated = await this.facilitiesRepository.deactivateAssignment(facilityId, userId);
    if (!deactivated) {
      throw new NotFoundError(FACILITY_MESSAGES.staffAssignmentNotFound);
    }

    return deactivated;
  }

  async listFacilityAssignments(
    facilityId: string,
    limit: number,
    offset: number,
    scope: FacilityScope,
  ) {
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
    return rows.map(({ assignment, userName, userEmail }) => ({
      ...assignment,
      userName,
      userEmail,
      facilityName: facility.name,
      facilityCode: facility.code,
    }));
  }

  async listUserAssignments(userId: string, role: Role | null | undefined) {
    if (role !== "FACILITY_STAFF" && role !== "FACILITY_MANAGER") return [];
    const rows = await this.facilitiesRepository.listUserAssignmentsWithFacilities(userId, role);
    return rows.map(({ assignment, facilityName, facilityCode }) => ({
      ...assignment,
      facilityName,
      facilityCode,
    }));
  }

  private assertManagerScope(scope: FacilityScope): void {
    if (scope.kind === "assigned" && scope.role !== "FACILITY_MANAGER") {
      throw new ForbiddenError(FACILITY_MESSAGES.facilityOperationDenied);
    }
  }
}
