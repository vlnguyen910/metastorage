import { ApiErrorCode } from "@metastorage/contracts";
import type { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";
import { errorBody } from "./core/http";
import { registerAuthHandlers } from "./handlers/auth.handlers";
import { registerBookingHandlers } from "./handlers/bookings.handlers";
import { registerDashboardHandlers } from "./handlers/dashboards.handlers";
import { registerFacilityHandlers } from "./handlers/facilities.handlers";
import { registerRentalHandlers } from "./handlers/rentals.handlers";
import { registerReservationHandlers } from "./handlers/reservations.handlers";
import { registerUsersHandlers } from "./handlers/users.handlers";

let installed = false;

export function installMockApi(http: AxiosInstance): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const delayResponse = Number(process.env.NEXT_PUBLIC_MOCK_DELAY_MS ?? 400);
  const mock = new MockAdapter(http, { delayResponse });

  registerAuthHandlers(mock);
  registerFacilityHandlers(mock);
  registerReservationHandlers(mock);
  registerRentalHandlers(mock);
  registerBookingHandlers(mock);
  registerDashboardHandlers(mock);
  registerUsersHandlers(mock);

  mock.onAny().reply(404, errorBody(ApiErrorCode.NOT_FOUND, "Mock endpoint chưa được định nghĩa"));
}
