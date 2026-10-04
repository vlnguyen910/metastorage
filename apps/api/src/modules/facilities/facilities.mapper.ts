import type {
  ApiFacility,
  ApiFacilityAssignment,
  ApiStorageUnit,
  FacilityAssignmentRole,
  StorageUnitStatus,
} from "@metastorage/contracts";
import type { Facility, FacilityAssignment, StorageUnit } from "@metastorage/database";

export function toApiFacility(facility: Facility): ApiFacility {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    address: facility.address,
    description: facility.description,
    isActive: facility.isActive,
    createdAt: facility.createdAt.toISOString(),
    updatedAt: facility.updatedAt.toISOString(),
  };
}

export function toApiFacilityAssignment(
  assignment: FacilityAssignment,
  extra?: { userName?: string; userEmail?: string; facilityName?: string; facilityCode?: string },
): ApiFacilityAssignment {
  return {
    id: assignment.id,
    userId: assignment.userId,
    facilityId: assignment.facilityId,
    assignedAt: assignment.assignedAt.toISOString(),
    endedAt: assignment.endedAt ? assignment.endedAt.toISOString() : null,
    isActive: assignment.isActive,
    role: assignment.role as FacilityAssignmentRole,
    userName: extra?.userName,
    userEmail: extra?.userEmail,
    facilityName: extra?.facilityName,
    facilityCode: extra?.facilityCode,
  };
}

export function toApiStorageUnit(
  unit: StorageUnit,
  extra?: {
    unitTypeName?: string;
    unitTypeSize?: number;
    monthlyPrice?: number;
    currentBookingId?: string | null;
    currentBookingCode?: string | null;
  },
): ApiStorageUnit {
  return {
    id: unit.id,
    facilityId: unit.facilityId,
    unitTypeId: unit.unitTypeId,
    code: unit.code,
    floor: unit.floor,
    locationDescription: unit.locationDescription,
    status: unit.status as StorageUnitStatus,
    unitTypeName: extra?.unitTypeName,
    unitTypeSize: extra?.unitTypeSize,
    monthlyPrice: extra?.monthlyPrice,
    currentBookingId: extra?.currentBookingId,
    currentBookingCode: extra?.currentBookingCode,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
