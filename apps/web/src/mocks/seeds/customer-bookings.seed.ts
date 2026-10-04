import type { CustomerBooking } from "@metastorage/contracts";

export const CUSTOMER_BOOKING_MOCK_NOW = "2026-10-04T00:00:00.000Z";
// Existing staff/inventory fixtures use legacy identifiers. Customer DTOs use UUIDs.
export const CUSTOMER_BOOKING_INVENTORY = {
  bookingId: "b0000000-0000-0000-0000-000000000001",
  facilityId: "fac-hcm-central",
  unitTypeId: "00000000-0000-0000-0001-000000000001",
} as const;
export function createCustomerBookingSeeds(): CustomerBooking[] {
  return [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      bookingCode: "BK-2026-0001",
      facility: {
        id: "f0000000-0000-4000-8000-000000000001",
        name: "storeX Sài Gòn Central",
        address: "123 Nguyễn Huệ, Quận 1, Hồ Chí Minh",
      },
      unitType: {
        id: "00000000-0000-4000-8001-000000000001",
        name: "Standard storage",
        sizeLabel: "2 m²",
      },
      checkInAt: "2026-10-08T02:00:00.000Z",
      checkInSlotEnd: "2026-10-08T04:00:00.000Z",
      rentalEndAt: "2026-11-08T02:00:00.000Z",
      durationMonths: 1,
      status: "CONFIRMED",
      rescheduleCount: 0,
      pricing: {
        rentalFeeAmount: "900000",
        depositAmount: "900000",
        totalAmount: "1800000",
        currency: "VND",
      },
      history: [],
      refund: null,
      actions: { canCancel: true, canReschedule: true, reasonCodes: [] },
    },
  ];
}
