import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { isActionAllowedInPortal, type ActionKey } from "@/lib/actions";

/**
 * Render children only when the current user is allowed to perform the action
 * AND the action belongs to the user's portal. Centralized — pages must NOT
 * write `if (role === "admin_ops")` next to buttons.
 */
export function ActionGate({
  action, fallback = null, children,
}: { action: ActionKey; fallback?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  return <>{isActionAllowedInPortal(user?.role ?? null, action) ? children : fallback}</>;
}

export function useAction(action: ActionKey): boolean {
  const { user } = useAuth();
  return isActionAllowedInPortal(user?.role ?? null, action);
}
