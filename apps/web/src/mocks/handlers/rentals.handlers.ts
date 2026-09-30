import type { RentalDetail, RentalListItem } from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { envelope } from "../core/http";

const rental: RentalDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  bookingId: "22222222-2222-2222-2222-222222222222",
  bookingCode: "BK-2026-0001",
  facility: {
    id: "33333333-3333-3333-3333-333333333333",
    name: "metastorage Đà Nẵng Riverside",
    address: "95 Ngô Quyền, Đà Nẵng",
  },
  unitType: {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Kho tiêu chuẩn",
    sizeLabel: "2 m²",
  },
  physicalUnit: { id: "55555555-5555-5555-5555-555555555555", code: "DN-001" },
  startAt: "2026-10-01T09:00:00.000Z",
  expectedEndAt: "2026-11-01T09:00:00.000Z",
  status: "ACTIVE",
  bookingStatus: "CONFIRMED",
  actions: {
    canCancel: false,
    canReschedule: false,
    note: "Các thao tác hủy, đổi lịch và yêu cầu hoàn tiền sẽ được bổ sung ở phiên bản sau.",
  },
  actualReturnAt: null,
  closedAt: null,
  depositAmount: "900000",
  checkInSlotStart: "2026-10-01T09:00:00.000Z",
  checkInSlotEnd: null,
  timeline: [
    { label: "Booking confirmed", status: "DONE", at: "2026-09-27T09:00:00.000Z" },
    { label: "Check-in", status: "CURRENT", at: "2026-10-01T09:00:00.000Z" },
    { label: "Return", status: "UPCOMING", at: "2026-11-01T09:00:00.000Z" },
  ],
};

export function registerRentalHandlers(mock: MockAdapter): void {
  mock.onGet("/rentals/mine").reply(200, envelope([rental as RentalListItem]));
  mock.onGet(/\/rentals\/[^/]+$/).reply(200, envelope(rental));
}
