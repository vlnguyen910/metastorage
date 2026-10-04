import type { Database } from "./client";
export type LifecycleExecutor = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type LifecycleAction = "CANCELLED" | "RESCHEDULED" | "NO_SHOW";
export type LifecycleBookingPolicy = {
  status: string;
  paidAt: Date | null;
  checkInSlotStart: Date;
  checkInSlotEnd: Date | null;
  rescheduleCount: number;
};
export type LifecycleMutation = {
  bookingId: string;
  customerId?: string;
  actorUserId?: string;
  action: LifecycleAction;
  idempotencyKey: string;
  checkInAt?: string;
  now: Date;
};
