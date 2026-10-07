import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { bookingConfirmationEmails } from "./booking-confirmation-emails";
import { bookings } from "./bookings";
import { capacityAllocations } from "./capacity-allocations";
import { checkInSlots } from "./check-in-slots";
import { checkInVerifications } from "./checkin-verifications";
import { customers } from "./customers";
import { facilities } from "./facilities";
import { facilityAssignments } from "./facility-assignments";
import { facilityOperatingHours } from "./facility-operating-hours";
import { facilityUnitTypes } from "./facility-unit-types";
import { paymentProviderEvents } from "./payment-provider-events";
import { payments } from "./payments";
import { rentals } from "./rentals";
import { reservationDrafts } from "./reservation-drafts";
import { sessions } from "./sessions";
import { storageUnits } from "./storage-units";
import { unitAssignments } from "./unit-assignments";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers),
  sessions: many(sessions),
  accounts: many(accounts),
  facilityAssignments: many(facilityAssignments),
  bookings: many(bookings),
  assignedUnits: many(unitAssignments),
  rentals: many(rentals),
  checkInVerifications: many(checkInVerifications),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  customer: one(customers, { fields: [payments.customerId], references: [customers.id] }),
}));

export const paymentProviderEventsRelations = relations(paymentProviderEvents, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentProviderEvents.paymentId],
    references: [payments.id],
  }),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  unitTypes: many(facilityUnitTypes),
  assignments: many(facilityAssignments),
  storageUnits: many(storageUnits),
  operatingHours: many(facilityOperatingHours),
  reservationDrafts: many(reservationDrafts),
  capacityAllocations: many(capacityAllocations),
  bookings: many(bookings),
  rentals: many(rentals),
  checkInVerifications: many(checkInVerifications),
}));

export const unitTypesRelations = relations(unitTypes, ({ many }) => ({
  facilities: many(facilityUnitTypes),
  storageUnits: many(storageUnits),
  bookings: many(bookings),
}));

export const facilityUnitTypesRelations = relations(facilityUnitTypes, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityUnitTypes.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [facilityUnitTypes.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const facilityAssignmentsRelations = relations(facilityAssignments, ({ one }) => ({
  user: one(users, {
    fields: [facilityAssignments.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [facilityAssignments.facilityId],
    references: [facilities.id],
  }),
}));

export const storageUnitsRelations = relations(storageUnits, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [storageUnits.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [storageUnits.unitTypeId],
    references: [unitTypes.id],
  }),
  assignments: many(unitAssignments),
  rentals: many(rentals),
}));

export const facilityOperatingHoursRelations = relations(facilityOperatingHours, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityOperatingHours.facilityId],
    references: [facilities.id],
  }),
}));

export const reservationDraftsRelations = relations(reservationDrafts, ({ one }) => ({
  facility: one(facilities, {
    fields: [reservationDrafts.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [reservationDrafts.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const capacityAllocationsRelations = relations(capacityAllocations, ({ one }) => ({
  facility: one(facilities, {
    fields: [capacityAllocations.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [capacityAllocations.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  checkInSlot: one(checkInSlots, {
    fields: [bookings.checkInSlotId],
    references: [checkInSlots.id],
  }),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  facility: one(facilities, {
    fields: [bookings.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [bookings.unitTypeId],
    references: [unitTypes.id],
  }),
  assignedStaff: one(users, {
    fields: [bookings.assignedStaffId],
    references: [users.id],
  }),
  unitAssignments: many(unitAssignments),
  rental: one(rentals),
  confirmationEmails: many(bookingConfirmationEmails),
  checkInVerifications: many(checkInVerifications),
}));

export const bookingConfirmationEmailsRelations = relations(
  bookingConfirmationEmails,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [bookingConfirmationEmails.bookingId],
      references: [bookings.id],
    }),
  }),
);

export const unitAssignmentsRelations = relations(unitAssignments, ({ one }) => ({
  booking: one(bookings, {
    fields: [unitAssignments.bookingId],
    references: [bookings.id],
  }),
  physicalUnit: one(storageUnits, {
    fields: [unitAssignments.physicalUnitId],
    references: [storageUnits.id],
  }),
  assigner: one(users, {
    fields: [unitAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const checkInVerificationsRelations = relations(checkInVerifications, ({ one }) => ({
  booking: one(bookings, {
    fields: [checkInVerifications.bookingId],
    references: [bookings.id],
  }),
  facility: one(facilities, {
    fields: [checkInVerifications.facilityId],
    references: [facilities.id],
  }),
  staff: one(users, {
    fields: [checkInVerifications.staffId],
    references: [users.id],
  }),
  unitAssignment: one(unitAssignments, {
    fields: [checkInVerifications.unitAssignmentId],
    references: [unitAssignments.id],
  }),
}));

export const rentalsRelations = relations(rentals, ({ one }) => ({
  booking: one(bookings, {
    fields: [rentals.bookingId],
    references: [bookings.id],
  }),
  customer: one(customers, {
    fields: [rentals.customerId],
    references: [customers.id],
  }),
  facility: one(facilities, {
    fields: [rentals.facilityId],
    references: [facilities.id],
  }),
  physicalUnit: one(storageUnits, {
    fields: [rentals.physicalUnitId],
    references: [storageUnits.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const checkInSlotsRelations = relations(checkInSlots, ({ many }) => ({
  bookings: many(bookings),
}));
