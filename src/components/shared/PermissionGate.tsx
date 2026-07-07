import type { ReactNode } from "react";
import { usePermission } from "@/lib/auth-context";
import type { Permission } from "@/lib/rbac";

/**
 * Conditionally render children based on the current user's permissions.
 * Centralized check — never write `if (role === "admin_super")` in pages.
 */
export function PermissionGate({
  permission, fallback = null, children,
}: { permission: Permission; fallback?: ReactNode; children: ReactNode }) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}
