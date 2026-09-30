import {
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { roleEnum, users } from "./users";

export const facilities = pgTable("facilities", {
  id: uuid().defaultRandom().primaryKey(),
  code: varchar({ length: 50 }).notNull().unique(),
  name: varchar({ length: 150 }).notNull(),
  address: text().notNull(),
  description: text(),
  isActive: boolean().default(true).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const FACILITY_ROLES = ["FACILITY_STAFF", "FACILITY_MANAGER"] as const;
export type FacilityRole = (typeof FACILITY_ROLES)[number];

export const facilityAssignments = pgTable(
  "facility_assignments",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp({ withTimezone: true }),
    isActive: boolean().default(true).notNull(),
    role: roleEnum().notNull(),
  },
  (table) => [
    uniqueIndex("facility_assignments_user_facility_idx").on(table.userId, table.facilityId),
    index("facility_assignments_facility_idx").on(table.facilityId),
  ],
);

export const STORAGE_UNIT_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "MAINTENANCE",
  "INSPECTION",
  "RETURN_PENDING",
  "LOCKED",
  "INACTIVE",
] as const;

export const storageUnitStatusEnum = pgEnum("storage_unit_status", STORAGE_UNIT_STATUSES);

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    sizeLabel: varchar("size_label", { length: 50 }).notNull(),
    sizeSqm: real("size_sqm").notNull(),
    monthlyPrice: integer("monthly_price").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unit_types_facility_code_idx").on(table.facilityId, table.code),
    uniqueIndex("unit_types_id_facility_idx").on(table.id, table.facilityId),
    index("unit_types_facility_idx").on(table.facilityId),
  ],
);

export const storageUnits = pgTable(
  "storage_units",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    unitTypeId: uuid().notNull(),
    code: varchar({ length: 80 }).notNull().unique(),
    floor: varchar({ length: 50 }),
    locationDescription: varchar({ length: 255 }),
    status: storageUnitStatusEnum().default("AVAILABLE").notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitTypeId, table.facilityId],
      foreignColumns: [unitTypes.id, unitTypes.facilityId],
    }).onDelete("restrict"),
    index("storage_units_facility_idx").on(table.facilityId),
    index("storage_units_facility_status_idx").on(table.facilityId, table.status),
    index("storage_units_unit_type_idx").on(table.unitTypeId),
  ],
);

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;

export type FacilityAssignment = typeof facilityAssignments.$inferSelect;
export type NewFacilityAssignment = typeof facilityAssignments.$inferInsert;

export type StorageUnit = typeof storageUnits.$inferSelect;
export type NewStorageUnit = typeof storageUnits.$inferInsert;

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;

export const facilityOperatingHours = pgTable(
  "facility_operating_hours",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    dayOfWeek: integer().notNull(),
    openTime: time().notNull(),
    closeTime: time().notNull(),
    timezone: varchar({ length: 64 }).default("Asia/Ho_Chi_Minh").notNull(),
  },
  (table) => [
    uniqueIndex("facility_operating_hours_facility_day_idx").on(table.facilityId, table.dayOfWeek),
    index("facility_operating_hours_facility_idx").on(table.facilityId),
  ],
);

export const RESERVATION_DRAFT_STATUSES = ["DRAFT"] as const;
export const RESERVATION_PRICING_STATUSES = ["PRICING_NOT_CONFIGURED"] as const;
export const CAPACITY_ALLOCATION_KINDS = ["HOLD", "BOOKING"] as const;
export const CAPACITY_ALLOCATION_STATUSES = ["ACTIVE", "RELEASED", "EXPIRED"] as const;

export const reservationDraftStatusEnum = pgEnum(
  "reservation_draft_status",
  RESERVATION_DRAFT_STATUSES,
);
export const reservationPricingStatusEnum = pgEnum(
  "reservation_pricing_status",
  RESERVATION_PRICING_STATUSES,
);
export const capacityAllocationKindEnum = pgEnum(
  "capacity_allocation_kind",
  CAPACITY_ALLOCATION_KINDS,
);
export const capacityAllocationStatusEnum = pgEnum(
  "capacity_allocation_status",
  CAPACITY_ALLOCATION_STATUSES,
);

export const reservationDrafts = pgTable(
  "reservation_drafts",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid().notNull(),
    checkInAt: timestamp({ withTimezone: true }).notNull(),
    rentalEndAt: timestamp({ withTimezone: true }).notNull(),
    durationMonths: integer().notNull(),
    contactName: varchar({ length: 150 }).notNull(),
    contactEmail: varchar({ length: 320 }).notNull(),
    contactPhone: varchar({ length: 32 }).notNull(),
    accessTokenHash: varchar({ length: 128 }),
    status: reservationDraftStatusEnum().default("DRAFT").notNull(),
    pricingStatus: reservationPricingStatusEnum().default("PRICING_NOT_CONFIGURED").notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitTypeId, table.facilityId],
      foreignColumns: [unitTypes.id, unitTypes.facilityId],
    }).onDelete("restrict"),
    index("reservation_drafts_facility_idx").on(table.facilityId),
    index("reservation_drafts_unit_type_idx").on(table.unitTypeId),
  ],
);

export const capacityAllocations = pgTable(
  "capacity_allocations",
  {
    id: uuid().defaultRandom().primaryKey(),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    unitTypeId: uuid().notNull(),
    referenceId: uuid().notNull(),
    accessTokenHash: varchar({ length: 128 }),
    kind: capacityAllocationKindEnum().notNull(),
    status: capacityAllocationStatusEnum().default("ACTIVE").notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitTypeId, table.facilityId],
      foreignColumns: [unitTypes.id, unitTypes.facilityId],
    }).onDelete("restrict"),
    index("capacity_allocations_unit_type_period_idx").on(
      table.unitTypeId,
      table.startsAt,
      table.endsAt,
    ),
    index("capacity_allocations_reference_idx").on(table.referenceId),
  ],
);

export type FacilityOperatingHours = typeof facilityOperatingHours.$inferSelect;
export type NewFacilityOperatingHours = typeof facilityOperatingHours.$inferInsert;
export type ReservationDraft = typeof reservationDrafts.$inferSelect;
export type NewReservationDraft = typeof reservationDrafts.$inferInsert;
export type CapacityAllocation = typeof capacityAllocations.$inferSelect;
export type NewCapacityAllocation = typeof capacityAllocations.$inferInsert;
