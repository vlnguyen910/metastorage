import { z } from "zod";

export enum UserRole {
  STORAGE_CUSTOMER = "CUSTOMER",
  FACILITY_STAFF = "FACILITY_STAFF",
  FACILITY_MANAGER = "FACILITY_MANAGER",
  BUSINESS_OPERATIONS_MANAGER = "BUSINESS_OPERATION_MANAGER",
  SYSTEM_ADMINISTRATOR = "SYSTEM_ADMIN",
}

export enum Permission {
  VIEW_FACILITIES = "VIEW_FACILITIES",
  CREATE_RESERVATION = "CREATE_RESERVATION",
  VIEW_OWN_RESERVATIONS = "VIEW_OWN_RESERVATIONS",
  VIEW_ASSIGNED_FACILITY = "VIEW_ASSIGNED_FACILITY",
  MANAGE_STORAGE_UNITS = "MANAGE_STORAGE_UNITS",
  HANDLE_CHECK_IN = "HANDLE_CHECK_IN",
  HANDLE_RETURN = "HANDLE_RETURN",
  VIEW_FACILITY_REPORTS = "VIEW_FACILITY_REPORTS",
  VIEW_SYSTEM_REPORTS = "VIEW_SYSTEM_REPORTS",
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_ROLES = "MANAGE_ROLES",
  VIEW_ACTIVITY_LOGS = "VIEW_ACTIVITY_LOGS",
}

export const UserRoleSchema = z.nativeEnum(UserRole);

export const PermissionSchema = z.nativeEnum(Permission);

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: UserRoleSchema,
});

export type User = z.infer<typeof UserSchema>;

export const ApiUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  assignedFacilityIds: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApiUser = z.infer<typeof ApiUserSchema>;
