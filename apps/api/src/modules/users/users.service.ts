import type { ApiUser } from "@storex/contracts";
import type { Role } from "@storex/database";
import { NotFoundError } from "../../common/errors/app-error";
import { toApiUser } from "./users.mapper";
import type { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getUserById(id: string): Promise<ApiUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id "${id}" not found`);
    }
    const assignedFacilityIds = await this.usersRepository.findAssignedFacilityIds(id);
    return toApiUser(user, assignedFacilityIds);
  }

  async listUsers(limit: number, offset: number): Promise<ApiUser[]> {
    return (await this.usersRepository.list(limit, offset)).map((user) => toApiUser(user));
  }

  async updateUserRole(id: string, role: Role): Promise<ApiUser> {
    const user = await this.usersRepository.updateRole(id, role);
    if (!user) {
      throw new NotFoundError(`User with id "${id}" not found`);
    }
    return toApiUser(user);
  }
}
