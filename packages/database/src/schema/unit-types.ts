import {
  boolean,
  integer,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const unitTypes = pgTable(
  "unit_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    code: varchar({ length: 80 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    sizeLabel: varchar("size_label", { length: 50 }).notNull(),
    sizeSqm: real("size_sqm").notNull(),
    monthlyPrice: integer("monthly_price").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("unit_types_code_idx").on(table.code)],
);

export type UnitType = typeof unitTypes.$inferSelect;
export type NewUnitType = typeof unitTypes.$inferInsert;
