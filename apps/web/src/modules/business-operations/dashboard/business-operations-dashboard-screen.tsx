import { UserRole } from "@metastorage/contracts";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export function BusinessOperationsDashboardScreen() {
  return <RoleDashboard role={UserRole.BUSINESS_OPERATIONS_MANAGER} />;
}
