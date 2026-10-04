import { type CustomerBooking, CustomerBookingSchema } from "@metastorage/contracts";
import { BookingLifecycleError, type BookingLifecycleRepository } from "@metastorage/database";
import { AppError, NotFoundError } from "../../common/errors/app-error";

export class CustomerBookingsService {
  constructor(
    private readonly repository: BookingLifecycleRepository,
    private readonly clock = () => new Date(),
  ) {}
  async mine(userId: string): Promise<CustomerBooking[]> {
    const customerId = await this.repository.customerId(userId);
    if (!customerId) return [];
    const rows = await this.repository.list(customerId);
    return Promise.all(rows.map((row) => this.get(userId, row.id)));
  }
  async get(userId: string, bookingId: string): Promise<CustomerBooking> {
    const customerId = await this.repository.customerId(userId);
    if (!customerId) throw new NotFoundError();
    const snapshot = await this.repository.snapshot(bookingId, customerId, this.clock());
    if (!snapshot) throw new NotFoundError();
    return CustomerBookingSchema.parse(snapshot);
  }
  async mutate(
    userId: string,
    bookingId: string,
    action: "CANCELLED" | "RESCHEDULED",
    input: { idempotencyKey: string; checkInAt?: string },
  ) {
    const customerId = await this.repository.customerId(userId);
    if (!customerId) throw new NotFoundError();
    try {
      const result = await this.repository.mutate({
        bookingId,
        customerId,
        actorUserId: userId,
        action,
        ...input,
        now: this.clock(),
      });
      return CustomerBookingSchema.parse(result);
    } catch (error) {
      if (error instanceof BookingLifecycleError)
        throw new AppError(error.message, error.statusCode, error.code);
      throw error;
    }
  }
}
