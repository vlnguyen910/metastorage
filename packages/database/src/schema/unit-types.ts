import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";

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

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;
