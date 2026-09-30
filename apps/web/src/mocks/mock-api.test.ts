import { createHttpClient, createMetastorageApiClient } from "@storex/api-client";
import type { SessionTokens } from "@storex/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import { resetMockDatabase } from "./database";
import { installMockApi } from "./install-mock-api";

let tokens: SessionTokens | null = null;
const http = createHttpClient({
  baseURL: "/api",
  tokenProvider: {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    updateTokens: (value) => {
      tokens = value;
    },
    clearSession: () => {
      tokens = null;
    },
  },
});
const client = createMetastorageApiClient(http);

describe("mock reservation API", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_MOCK_DELAY_MS = "0";
    resetMockDatabase();
    installMockApi(http);
    const session = await client.auth.login({
      email: "customer@storex.vn",
      password: "Demo@123",
    });
    tokens = session;
  });

  it("searches facilities and returns aggregated availability", async () => {
    const facilities = await client.facilities.list({ search: "Sài Gòn" });
    expect(facilities.total).toBe(1);
    const availability = await client.facilities.availability(facilities.items[0]?.id ?? "");
    expect(availability.some((option) => option.availableCount > 0)).toBe(true);
  });

  it("browses the public catalog without using the protected facility API", async () => {
    const facilities = await client.catalog.listFacilities();
    expect(facilities.total).toBeGreaterThan(0);
    const facility = facilities.items.find((item) => item.code === "HCM-01");
    expect(facility?.availableUnits).toBeGreaterThan(0);

    const unitTypes = await client.catalog.listUnitTypes(facility?.id ?? "");
    expect(unitTypes.every((option) => option.facilityId === facility?.id)).toBe(true);
    expect(unitTypes.some((option) => option.availableCount > 0)).toBe(true);
  });

  it("does not create a reservation when payment fails and can retry successfully", async () => {
    const quote = await client.reservations.quote({
      facilityId: "fac-hcm-central",
      unitTypeId: "00000000-0000-0000-0001-000000000001",
      startDate: "2026-10-01",
      durationMonths: 3,
    });
    expect(quote.depositAmount).toBe(quote.monthlyPrice);
    expect(quote.rentalTotal).toBe(quote.monthlyPrice * 3);

    await expect(
      client.reservations.confirm({
        quoteId: quote.id,
        paymentToken: "tok_fail",
        cardBrand: "Visa",
        cardLast4: "0002",
      }),
    ).rejects.toMatchObject({ response: { status: 402 } });
    expect(await client.reservations.mine()).toHaveLength(0);

    const reservation = await client.reservations.confirm({
      quoteId: quote.id,
      paymentToken: "tok_success",
      cardBrand: "Visa",
      cardLast4: "4242",
    });
    expect(reservation.payment.last4).toBe("4242");
    expect((await client.reservations.mine())[0]?.id).toBe(reservation.id);
  });

  it("allows FM to assign staff and allows Staff to view assigned tasks", async () => {
    // 1. FM logs in and assigns staff to BK-2026-0001
    const fmSession = await client.auth.login({
      email: "manager@storex.vn",
      password: "Demo@123",
    });
    tokens = fmSession;

    const staffList = await client.facilities.getStaff("fac-hcm-central");
    expect(staffList.length).toBeGreaterThan(0);
    const targetStaff = staffList[0];
    if (!targetStaff) throw new Error("Staff not found");

    const assignedBooking = await client.bookings.assignStaff(
      "b0000000-0000-0000-0000-000000000001",
      { staffId: targetStaff.id, notes: "Ca sáng" },
    );
    expect(assignedBooking.assignedStaff?.id).toBe(targetStaff.id);

    // 2. Staff logs in and fetches assigned tasks
    const staffSession = await client.auth.login({
      email: "staff@storex.vn",
      password: "Demo@123",
    });
    tokens = staffSession;

    const tasks = await client.bookings.getMyStaffTasks("fac-hcm-central");
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.bookingCode === "BK-2026-0001")).toBe(true);
  });
});
