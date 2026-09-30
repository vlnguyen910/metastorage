import type { ApiUser } from "@metastorage/contracts";
import type { Role } from "@metastorage/database";
import { NotFoundError } from "../../common/errors/app-error";
import { toApiUser } from "./users.mapper";
import { USER_MESSAGES } from "./users.messages";
import type { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getUserById(id: string): Promise<ApiUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(USER_MESSAGES.userNotFound(id));
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
      throw new NotFoundError(USER_MESSAGES.userNotFound(id));
    }
    return toApiUser(user);
  }
}
