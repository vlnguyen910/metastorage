import { UserRole } from "@metastorage/contracts";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export function SystemAdministratorDashboardScreen() {
  return <RoleDashboard role={UserRole.SYSTEM_ADMINISTRATOR} />;
}
