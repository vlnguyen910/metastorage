import type { MockDatabase } from "../types";
import { bookingSeeds } from "./bookings.seed";
import { facilitySeeds } from "./facilities.seed";
import { storageUnitSeeds } from "./storage-units.seed";
import { userSeeds } from "./users.seed";

export { bookingSeeds } from "./bookings.seed";
export { demoAccounts } from "./users.seed";

export function createSeedDatabase(): MockDatabase {
  return {
    version: 3,
    users: structuredClone(userSeeds),
    facilities: structuredClone(facilitySeeds),
    units: structuredClone(storageUnitSeeds),
    quotes: [],
    reservations: [],
    payments: [],
    bookings: structuredClone(bookingSeeds),
  };
}
