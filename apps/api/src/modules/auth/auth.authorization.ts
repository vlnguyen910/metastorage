import { ROLES, type Role } from "@metastorage/database";
import { ForbiddenError } from "../../common/errors/app-error";

type AuthorizationUser = {
  role: string | null | undefined;
  status: string | null | undefined;
};

function isRole(value: string | null | undefined): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function assertActiveUser(user: AuthorizationUser): asserts user is AuthorizationUser & {
  status: "ACTIVE";
} {
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("Tài khoản này đã bị vô hiệu hóa");
  }
}

export function assertUserHasRole(
  user: AuthorizationUser,
  allowedRoles: readonly Role[],
): asserts user is AuthorizationUser & { role: Role } {
  if (!isRole(user.role) || !allowedRoles.includes(user.role)) {
    throw new ForbiddenError("Bạn không có quyền thực hiện thao tác này");
  }
}
