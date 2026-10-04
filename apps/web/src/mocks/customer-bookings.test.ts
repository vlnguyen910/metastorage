import { createMetastorageApiClient } from "@metastorage/api-client";
import { CustomerBookingSchema, StorageUnitStatus, UserRole } from "@metastorage/contracts";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, it } from "vitest";
import { getMockDatabase, resetMockDatabase, saveMockDatabase } from "./database";
import { registerCustomerBookingHandlers } from "./handlers/customer-bookings.handlers";

const http = axios.create();
const mock = new MockAdapter(http);
registerCustomerBookingHandlers(mock);
const api = createMetastorageApiClient(http);
const id = "b0000000-0000-4000-8000-000000000001";
describe("customer booking mock and API client", () => {
  beforeEach(() => {
    resetMockDatabase();
    http.defaults.headers.common.Authorization = "Bearer access:user-1:test";
  });
  it("returns the customer DTO and hides bookings belonging to another customer", async () => {
    expect(CustomerBookingSchema.safeParse((await api.bookings.mine())[0]).success).toBe(true);
    const db = getMockDatabase();
    const customer = db.users[0];
    if (!customer) throw new Error("Missing seeded customer");
    db.users.push({ ...customer, id: "other-customer", role: UserRole.STORAGE_CUSTOMER });
    saveMockDatabase(db);
    http.defaults.headers.common.Authorization = "Bearer access:other-customer:test";
    expect(await api.bookings.mine()).toEqual([]);
    await expect(api.bookings.customerGet(id)).rejects.toMatchObject({ response: { status: 404 } });
  });
  it("refunds only the rental fee, forfeits deposit and replays cancellation once", async () => {
    const input = { idempotencyKey: "cancel-1" };
    const cancelled = await api.bookings.cancel(id, input);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.refund).toMatchObject({
      amount: "900000",
      forfeitedDepositAmount: "900000",
      simulation: true,
    });
    expect(await api.bookings.cancel(id, input)).toEqual(cancelled);
    expect((await api.bookings.customerGet(id)).history).toHaveLength(1);
    await expect(
      api.bookings.reschedule(id, {
        idempotencyKey: "different",
        checkInAt: "2026-10-10T09:00:00+07:00",
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it("preserves price and duration, replays retries, and enforces two reschedules", async () => {
    const original = await api.bookings.customerGet(id);
    const input = { idempotencyKey: "move-1", checkInAt: "2026-10-10T09:00:00+07:00" };
    const moved = await api.bookings.reschedule(id, input);
    expect(moved.pricing).toEqual(original.pricing);
    expect(moved.durationMonths).toBe(original.durationMonths);
    expect(moved.rentalEndAt).toBe("2026-11-10T02:00:00.000Z");
    expect(await api.bookings.reschedule(id, input)).toEqual(moved);
    await expect(
      api.bookings.reschedule(id, { ...input, checkInAt: "2026-10-11T09:00:00+07:00" }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    await api.bookings.reschedule(id, { ...input, idempotencyKey: "move-2" });
    await expect(
      api.bookings.reschedule(id, { ...input, idempotencyKey: "move-3" }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    expect((await api.bookings.customerGet(id)).history).toHaveLength(2);
  });
  it("leaves bookings unchanged when capacity, date or strict validation fails", async () => {
    const original = await api.bookings.customerGet(id);
    await expect(
      http.post(`/bookings/${id}/reschedule`, {
        idempotencyKey: "bad",
        checkInAt: "2026-10-10T09:00:00+07:00",
        durationMonths: 6,
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    await expect(
      api.bookings.reschedule(id, {
        idempotencyKey: "date",
        checkInAt: "2026-12-10T09:00:00+07:00",
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    const db = getMockDatabase();
    db.units.forEach((unit) => {
      unit.status = StorageUnitStatus.MAINTENANCE;
    });
    saveMockDatabase(db);
    await expect(
      api.bookings.reschedule(id, {
        idempotencyKey: "capacity",
        checkInAt: "2026-10-10T09:00:00+07:00",
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    expect(await api.bookings.customerGet(id)).toEqual(original);
  });
  it("rejects late reschedules and terminal booking changes", async () => {
    await api.bookings.mine();
    const db = getMockDatabase();
    const booking = db.customerBookings?.[0];
    if (!booking) throw new Error("Missing seeded booking");
    booking.checkInAt = "2026-10-04T12:00:00.000Z";
    saveMockDatabase(db);
    await expect(
      api.bookings.reschedule(id, {
        idempotencyKey: "late",
        checkInAt: "2026-10-10T09:00:00+07:00",
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    for (const status of ["CHECKED_IN", "NO_SHOW"] as const) {
      const state = getMockDatabase();
      const terminal = state.customerBookings?.[0];
      if (!terminal) throw new Error("Missing seeded booking");
      terminal.status = status;
      saveMockDatabase(state);
      await expect(api.bookings.cancel(id, { idempotencyKey: status })).rejects.toMatchObject({
        response: { status: 409 },
      });
    }
  });
});
