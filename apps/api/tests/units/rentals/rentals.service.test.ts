import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RentalsRepository } from "../../../src/modules/rentals/rentals.repository";
import { RentalsService } from "../../../src/modules/rentals/rentals.service";

const userId = "11111111-1111-1111-1111-111111111111";
const customerId = "22222222-2222-2222-2222-222222222222";
const rentalId = "33333333-3333-3333-3333-333333333333";

function repository(overrides: Partial<RentalsRepository> = {}) {
  return {
    findCustomerId: async () => customerId,
    listByCustomerId: async () => [],
    findByIdAndCustomerId: async () => null,
    ...overrides,
  } as RentalsRepository;
}

describe("RentalsService customer ownership", () => {
  it("returns an empty list when the User has no linked Customer", async () => {
    const service = new RentalsService(repository({ findCustomerId: async () => null }));
    assert.deepEqual(await service.listMine(userId), []);
  });

  it("queries rentals through the linked Customer", async () => {
    let queriedCustomerId = "";
    const service = new RentalsService(
      repository({
        listByCustomerId: async (id) => {
          queriedCustomerId = id;
          return [];
        },
      }),
    );
    await service.listMine(userId);
    assert.equal(queriedCustomerId, customerId);
  });

  it("rejects a Rental that is not owned by the linked Customer", async () => {
    const service = new RentalsService(repository({ findByIdAndCustomerId: async () => null }));
    await assert.rejects(() => service.getMine(rentalId, userId), { name: "NotFoundError" });
  });
});
