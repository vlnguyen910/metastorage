import type { ApiUnitType, UnitTypeListQuery } from "@metastorage/contracts";
import { NotFoundError } from "../../common/errors/app-error";
import type { FacilitiesRepository } from "../facilities/facilities.repository";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";
import type { UnitTypesRepository } from "./unit-types.repository";

export class UnitTypesService {
  constructor(
    private readonly repository: UnitTypesRepository,
    private readonly facilitiesRepository: FacilitiesRepository,
  ) {}

  async listByFacility(facilityId: string, query: UnitTypeListQuery): Promise<ApiUnitType[]> {
    const facility = await this.facilitiesRepository.findById(facilityId);
    if (!facility?.isActive) {
      throw new NotFoundError(UNIT_TYPE_MESSAGES.facilityUnavailable);
    }

    const unitTypes = await this.repository.listByFacility(facilityId, query.limit, query.offset);
    return unitTypes.map((unitType) => ({
      id: unitType.id,
      code: unitType.code,
      name: unitType.name,
      sizeLabel: unitType.sizeLabel,
      sizeSqm: unitType.sizeSqm,
      monthlyPrice: unitType.monthlyPrice,
      isActive: unitType.isActive,
      createdAt: unitType.createdAt.toISOString(),
      updatedAt: unitType.updatedAt.toISOString(),
    }));
  }
}
