import { UserRole } from "@metastorage/contracts";
import type { ReactNode } from "react";
import { ProtectedArea } from "@/components/layout/protected-area";
export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedArea allowedRole={UserRole.BUSINESS_OPERATIONS_MANAGER}>{children}</ProtectedArea>
  );
}
