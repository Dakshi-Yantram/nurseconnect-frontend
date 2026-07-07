import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { portalHome } from "@/lib/rbac";

/**
 * Root entry — routes user to their portal home based on role.
 * Falls back to login when no session exists.
 *
 * Waits on auth hydration so a refresh on "/" doesn't flash to /auth/login
 * before the session is restored.
 */
export const Route = createFileRoute("/")({
  component: RootRedirect,
});

function RootRedirect() {
  const { user, isAuthenticated, hydrated } = useAuth();
  if (!hydrated) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-[12.5px] text-muted-foreground">Loading…</div>
      </div>
    );
  }
 if (!isAuthenticated || !user) return <Navigate to="/auth/login" search={{ redirect: undefined }} />;
  return <Navigate to={portalHome(user.role)} />;
}
