import type { CheckInSlotsRepository } from "./check-in-slots.repository";
import type { ResolvedCheckInSlot } from "./check-in-slots.types";

export class CheckInSlotsService {
  constructor(private readonly repository: CheckInSlotsRepository) {}

  findForCheckIn(checkInAt: Date): Promise<ResolvedCheckInSlot | null> {
    return this.repository.findForCheckIn(checkInAt);
  }
}
