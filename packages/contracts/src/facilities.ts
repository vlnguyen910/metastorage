import { z } from "zod";
import { UserRole } from "./users";

export enum FacilityStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

export const FacilityAddressSchema = z.object({
  line1: z.string(),
  ward: z.string(),
  district: z.string(),
  city: z.string(),
});

export type FacilityAddress = z.infer<typeof FacilityAddressSchema>;

export const FacilitySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  address: FacilityAddressSchema,
  phone: z.string(),
  openingHours: z.string(),
  features: z.array(z.string()),
  status: z.nativeEnum(FacilityStatus),
  availableUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().positive(),
  startingMonthlyPrice: z.number().nonnegative(),
});

export type Facility = z.infer<typeof FacilitySchema>;

export type FacilitySummary = Facility;

export const FacilityAssignmentRoleSchema = z.enum(["FACILITY_STAFF", "FACILITY_MANAGER"]);

export type FacilityAssignmentRole = z.infer<typeof FacilityAssignmentRoleSchema>;

export const ApiFacilitySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApiFacility = z.infer<typeof ApiFacilitySchema>;

export const ApiFacilityAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  facilityId: z.string().uuid(),
  assignedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  role: FacilityAssignmentRoleSchema,
  userName: z.string().optional(),
  userEmail: z.string().optional(),
  facilityName: z.string().optional(),
  facilityCode: z.string().optional(),
});

export type ApiFacilityAssignment = z.infer<typeof ApiFacilityAssignmentSchema>;

export const FacilityStaffMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.literal(UserRole.FACILITY_STAFF),
  isActive: z.boolean(),
});

export type FacilityStaffMember = z.infer<typeof FacilityStaffMemberSchema>;

export type { FacilityListParams } from "./facilities.types";
