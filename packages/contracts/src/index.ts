import { z } from "zod";
import { CONTRACT_MESSAGES } from "./messages";
import type { CookieSession } from "./types";

export { CONTRACT_MESSAGES } from "./messages";

export type {
  ApiEnvelope,
  ApiErrorBody,
  CatalogFacilityListParams,
  ConfirmReservationInput,
  CookieSession,
  DashboardActivity,
  DashboardKpi,
  DashboardSummary,
  FacilityListParams,
  LoginInput,
  PaginatedResult,
  ReservationQuoteInput,
} from "./types";

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

export enum FacilityStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
}

export enum StorageUnitStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  MAINTENANCE = "MAINTENANCE",
  INSPECTION = "INSPECTION",
  RETURN_PENDING = "RETURN_PENDING",
  LOCKED = "LOCKED",
  INACTIVE = "INACTIVE",
}

export enum ReservationStatus {
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  CHECKED_IN = "CHECKED_IN",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNIT_UNAVAILABLE = "UNIT_UNAVAILABLE",
  RESERVATION_CONFLICT = "RESERVATION_CONFLICT",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  CAPACITY_UNAVAILABLE = "CAPACITY_UNAVAILABLE",
  INVALID_CHECK_IN = "INVALID_CHECK_IN",
  PRICING_NOT_CONFIGURED = "PRICING_NOT_CONFIGURED",
  HOLD_CONFLICT = "HOLD_CONFLICT",
  HOLD_EXPIRED = "HOLD_EXPIRED",
  OUT_OF_FACILITY_SCOPE = "OUT_OF_FACILITY_SCOPE",
  BOOKING_NOT_FOUND = "BOOKING_NOT_FOUND",
  PHYSICAL_UNIT_NOT_FOUND = "PHYSICAL_UNIT_NOT_FOUND",
  INVALID_UNIT_ASSIGNMENT = "INVALID_UNIT_ASSIGNMENT",
  UNIT_ASSIGNMENT_CONFLICT = "UNIT_ASSIGNMENT_CONFLICT",
  STAFF_NOT_IN_FACILITY = "STAFF_NOT_IN_FACILITY",
  INVALID_STAFF_ROLE = "INVALID_STAFF_ROLE",
  STAFF_INACTIVE = "STAFF_INACTIVE",
}

export const UserRoleSchema = z.nativeEnum(UserRole);
export const PermissionSchema = z.nativeEnum(Permission);

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  assignedFacilityIds: z.array(z.string()),
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

export const SessionSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;
export type SessionTokens = Pick<Session, "accessToken" | "refreshToken" | "expiresAt">;
export type ClientSession = Session | CookieSession;

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

export const CatalogFacilitySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  availableUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().positive(),
  startingMonthlyPrice: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CatalogFacility = z.infer<typeof CatalogFacilitySchema>;

export const CatalogUnitTypeSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  unitType: z.string(),
  sizeLabel: z.string(),
  sizeSqm: z.number().positive(),
  monthlyPrice: z.number().nonnegative(),
  availableCount: z.number().int().nonnegative(),
});
export type CatalogUnitType = z.infer<typeof CatalogUnitTypeSchema>;

export const UnitAvailabilityOptionSchema = z.object({
  facilityId: z.string(),
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  sizeSqm: z.number().positive(),
  monthlyPrice: z.number().nonnegative(),
  availableCount: z.number().int().nonnegative(),
});
export type UnitAvailabilityOption = z.infer<typeof UnitAvailabilityOptionSchema>;

export const ReservationQuoteSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  startDate: z.string(),
  durationMonths: z.number().int().min(1).max(12),
  monthlyPrice: z.number().nonnegative(),
  rentalTotal: z.number().nonnegative(),
  depositAmount: z.number().nonnegative(),
  totalEstimated: z.number().nonnegative(),
  expiresAt: z.string(),
});
export type ReservationQuote = z.infer<typeof ReservationQuoteSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  reservationId: z.string(),
  amount: z.number().nonnegative(),
  status: z.nativeEnum(PaymentStatus),
  brand: z.string(),
  last4: z.string().length(4),
  paidAt: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const ReservationSchema = z.object({
  id: z.string(),
  code: z.string(),
  customerId: z.string(),
  facility: FacilitySchema,
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  durationMonths: z.number().int(),
  status: z.nativeEnum(ReservationStatus),
  monthlyPrice: z.number(),
  depositAmount: z.number(),
  totalEstimated: z.number(),
  payment: PaymentSchema,
  createdAt: z.string(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const CustomerSignUpInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(255),
    phone: z.string().trim().min(1).max(20),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    callbackTarget: z.enum(["web", "mobile"]),
  })
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: CONTRACT_MESSAGES.passwordsDoNotMatch,
      });
    }
  });
export type CustomerSignUpInput = z.infer<typeof CustomerSignUpInputSchema>;

export const ReservationDraftContactSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().email().max(320),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});
export type ReservationDraftContact = z.infer<typeof ReservationDraftContactSchema>;

export const ReservationDraftInputSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime({ offset: true }),
  durationMonths: z.number().int().min(1).max(12),
  contact: ReservationDraftContactSchema,
});
export type ReservationDraftInput = z.infer<typeof ReservationDraftInputSchema>;

export const ReservationDraftSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime(),
  rentalEndAt: z.string().datetime(),
  durationMonths: z.number().int().min(1).max(12),
  contact: ReservationDraftContactSchema,
  draftAccessToken: z.string().min(32),
  status: z.literal("DRAFT"),
  pricingStatus: z.literal("PRICING_NOT_CONFIGURED"),
  pricing: z.null(),
});
export type ReservationDraft = z.infer<typeof ReservationDraftSchema>;

export const ReservationHoldSchema = z.object({
  holdId: z.string().uuid(),
  holdToken: z.string().min(32),
  unitTypeId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.literal("ACTIVE"),
});
export type ReservationHold = z.infer<typeof ReservationHoldSchema>;

export const PaymentCheckoutInputSchema = z.object({
  holdToken: z.string().min(32),
  idempotencyKey: z.string().min(16).max(128),
  paymentMethodToken: z.string().min(1),
});
export type PaymentCheckoutInput = z.infer<typeof PaymentCheckoutInputSchema>;

export const PaidBookingSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  customerId: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime(),
  rentalEndAt: z.string().datetime(),
  durationMonths: z.number().int().min(1).max(12),
  status: z.literal("CONFIRMED"),
  paidAt: z.string().datetime(),
  contact: ReservationDraftContactSchema,
  pricing: z.object({
    rentalFeeAmount: z.string(),
    depositAmount: z.string(),
    totalAmount: z.string(),
    currency: z.string().length(3),
  }),
});
export type PaidBooking = z.infer<typeof PaidBookingSchema>;

export const PaymentResultSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("SUCCEEDED"),
  provider: z.string(),
  providerPaymentId: z.string(),
  paidAt: z.string().datetime(),
  pricing: PaidBookingSchema.shape.pricing,
  booking: PaidBookingSchema,
  confirmation: z.lazy(() => BookingConfirmationSchema).optional(),
});
export type PaymentResult = z.infer<typeof PaymentResultSchema>;

export const BookingConfirmationSchema = z.object({
  bookingId: z.string().uuid(),
  bookingCode: z.string(),
  qrToken: z.string().min(32),
  qrUrl: z.string().url(),
  facility: z.object({ name: z.string(), address: z.string() }),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
  unitTypeName: z.string(),
  sizeLabel: z.string(),
  durationMonths: z.number().int().min(1).max(12),
  emailStatus: z.enum(["QUEUED", "PENDING", "SENT", "FAILED"]),
});
export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;

export const BookingQrVerificationInputSchema = z.object({
  qrToken: z.string().min(32),
});
export type BookingQrVerificationInput = z.infer<typeof BookingQrVerificationInputSchema>;

export const BookingQrVerificationResultSchema = z.object({
  bookingId: z.string().uuid(),
  bookingCode: z.string(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInSlotStart: z.string().datetime(),
  rentalEndAt: z.string().datetime(),
});
export type BookingQrVerificationResult = z.infer<typeof BookingQrVerificationResultSchema>;

export const CheckInLookupTypeSchema = z.enum(["QR_TOKEN", "BOOKING_CODE"]);
export type CheckInLookupType = z.infer<typeof CheckInLookupTypeSchema>;

export const CheckInLookupInputSchema = z.object({
  type: CheckInLookupTypeSchema,
  value: z.string().trim().min(1).max(500),
});
export type CheckInLookupInput = z.infer<typeof CheckInLookupInputSchema>;

export const CheckInEligibilityReasonCodeSchema = z.enum([
  "TOO_EARLY",
  "DEADLINE_PASSED",
  "CHECKIN_SLOT_NOT_CONFIGURED",
  "INVALID_BOOKING_STATUS",
  "PAYMENT_NOT_SUCCEEDED",
  "UNIT_NOT_ASSIGNED",
]);
export type CheckInEligibilityReasonCode = z.infer<typeof CheckInEligibilityReasonCodeSchema>;

export const PhysicalUnitAssignmentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  physicalUnitId: z.string().uuid(),
  physicalUnitCode: z.string(),
  assignedBy: z.string().uuid(),
  assignerName: z.string().optional(),
  status: z.enum(["ACTIVE", "REASSIGNED", "CANCELLED"]),
  assignedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  reason: z.string().nullable().optional(),
});
export type PhysicalUnitAssignment = z.infer<typeof PhysicalUnitAssignmentSchema>;

export const FacilityStaffMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.literal(UserRole.FACILITY_STAFF),
  isActive: z.boolean(),
});
export type FacilityStaffMember = z.infer<typeof FacilityStaffMemberSchema>;

export const AssignBookingStaffInputSchema = z.object({
  staffId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
export type AssignBookingStaffInput = z.infer<typeof AssignBookingStaffInputSchema>;

export const CheckInVerificationStatusSchema = z.enum(["VERIFIED", "CONSUMED", "INVALIDATED"]);
export type CheckInVerificationStatus = z.infer<typeof CheckInVerificationStatusSchema>;

export const CheckInVerificationSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  facilityId: z.string().uuid(),
  staffId: z.string().uuid(),
  unitAssignmentId: z.string().uuid(),
  status: CheckInVerificationStatusSchema,
  verifiedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  invalidatedAt: z.string().datetime().nullable(),
  invalidatedReason: z.string().nullable(),
});
export type CheckInVerification = z.infer<typeof CheckInVerificationSchema>;

export const CheckInPaymentSummarySchema = z.object({
  status: z.nativeEnum(PaymentStatus).nullable(),
  paidAt: z.string().datetime().nullable(),
  totalAmount: z.number().nonnegative().nullable(),
  rentalFeeAmount: z.number().nonnegative().nullable(),
  depositAmount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
});
export type CheckInPaymentSummary = z.infer<typeof CheckInPaymentSummarySchema>;

export const CheckInEligibilitySchema = z.object({
  canProceed: z.boolean(),
  reasons: z.array(CheckInEligibilityReasonCodeSchema),
});
export type CheckInEligibility = z.infer<typeof CheckInEligibilitySchema>;

export const CheckInBookingSummarySchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  unitTypeName: z.string(),
  unitTypeSizeLabel: z.string(),
  customerId: z.string().uuid(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  totalAmount: z.number().nonnegative(),
  requestedMonths: z.number().int(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  graceEndsAt: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
});
export type CheckInBookingSummary = z.infer<typeof CheckInBookingSummarySchema>;

export const CheckInLookupResultSchema = z.object({
  booking: CheckInBookingSummarySchema,
  payment: CheckInPaymentSummarySchema,
  assignedUnit: PhysicalUnitAssignmentSchema.nullable(),
  eligibility: CheckInEligibilitySchema,
  verification: CheckInVerificationSchema.nullable(),
});
export type CheckInLookupResult = z.infer<typeof CheckInLookupResultSchema>;

export const CheckInConfirmResultSchema = CheckInLookupResultSchema;
export type CheckInConfirmResult = z.infer<typeof CheckInConfirmResultSchema>;

export const BookingListItemSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  unitTypeId: z.string().uuid(),
  unitTypeName: z.string(),
  unitTypeSizeLabel: z.string(),
  customerId: z.string().uuid(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
  requestedMonths: z.number().int(),
  totalAmount: z.number().nonnegative(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  paidAt: z.string().datetime().nullable(),
  assignedUnit: PhysicalUnitAssignmentSchema.nullable().optional(),
  assignedStaff: FacilityStaffMemberSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});
export type BookingListItem = z.infer<typeof BookingListItemSchema>;

export const RentalStatusSchema = z.string().min(1);
export type RentalStatus = z.infer<typeof RentalStatusSchema>;

export const RentalActionStateSchema = z.object({
  canCancel: z.literal(false),
  canReschedule: z.literal(false),
  note: z.string(),
});
export type RentalActionState = z.infer<typeof RentalActionStateSchema>;

export const RentalListItemSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  bookingCode: z.string(),
  facility: z.object({
    id: z.string().uuid(),
    name: z.string(),
    address: z.string(),
  }),
  unitType: z.object({
    id: z.string().uuid(),
    name: z.string(),
    sizeLabel: z.string(),
  }),
  physicalUnit: z.object({ id: z.string().uuid(), code: z.string() }).nullable(),
  startAt: z.string().datetime(),
  expectedEndAt: z.string().datetime(),
  status: RentalStatusSchema,
  bookingStatus: z.string(),
  actions: RentalActionStateSchema,
});
export type RentalListItem = z.infer<typeof RentalListItemSchema>;
export const RentalDetailSchema = RentalListItemSchema.extend({
  actualReturnAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  depositAmount: z.string(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  timeline: z.array(
    z.object({
      label: z.string(),
      status: z.enum(["DONE", "CURRENT", "UPCOMING"]),
      at: z.string().datetime().nullable(),
    }),
  ),
});
export type RentalDetail = z.infer<typeof RentalDetailSchema>;

export const EligibleUnitSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  code: z.string(),
  floor: z.string().nullable().optional(),
  locationDescription: z.string().nullable().optional(),
  status: z.string(),
  isAvailableForPeriod: z.boolean(),
});
export type EligibleUnit = z.infer<typeof EligibleUnitSchema>;

export const AssignPhysicalUnitInputSchema = z.object({
  physicalUnitId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type AssignPhysicalUnitInput = z.infer<typeof AssignPhysicalUnitInputSchema>;
