import { NotFoundError } from "../../common/errors/app-error";
import { RENTAL_MESSAGES } from "./rentals.messages";
import type { RentalsRepository } from "./rentals.repository";

export class RentalsService {
  constructor(private readonly repository: RentalsRepository) {}

  async listMine(userId: string) {
    const customerId = await this.repository.findCustomerId(userId);
    return customerId ? this.repository.listByCustomerId(customerId) : [];
  }

  async getMine(rentalId: string, userId: string) {
    const customerId = await this.repository.findCustomerId(userId);
    if (!customerId) throw new NotFoundError(RENTAL_MESSAGES.rentalNotFound);
    const rental = await this.repository.findByIdAndCustomerId(rentalId, customerId);
    if (!rental) throw new NotFoundError(RENTAL_MESSAGES.rentalNotFound);
    return rental;
  }
}
