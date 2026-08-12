import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { canAccessRoute, portalForRole, routePortal } from "@/lib/rbac";
import { Unauthorized } from "@/components/shared/Unauthorized";

/**
 * Role + portal-aware web portal shell.
 *
 * Stabilization (Phase 5.x):
 *  - Wait for the auth session to hydrate before triggering ANY redirect.
 *    Otherwise refreshes on deep-linked operational routes
 *    (e.g. /worker/visits/abc, /consumer/bookings/123) bounce to
 *    /auth/login before localStorage is read, destroying the deep link.
 *  - When redirecting to /auth/login, carry the requested path as
 *    ?redirect=... so login can return the user to the exact page.
 *  - Cross-portal access renders Unauthorized in place instead of
 *    silently bouncing back to the portal home — preserves the URL and
 *    avoids aggressive fallback redirects.
 *  - Wrong portal redirects are removed; portal isolation is enforced
 *    by the Unauthorized boundary, not by hijacking the route.
 *
 * SSR fix (Phase 5.x+1):
 *  - <Navigate> on the server causes a hydration mismatch because the
 *    server emits a redirect shell but the client (after reading
 *    localStorage) may want to render the real page.  Guard the redirect
 *    with a typeof-window check so SSR always returns the Loading shell
 *    and the real routing decision is deferred to the client.
 */

const LoadingShell = () => (
  <div className="flex min-h-screen bg-background items-center justify-center">
    <div className="text-[12.5px] text-muted-foreground">Loading…</div>
  </div>
);

export function AppShell() {
  const { user, isAuthenticated, hydrated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer any time the route changes (covers back/forward
  // navigation and any nav path we didn't explicitly wire an onClick for).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // SSR: never make routing decisions on the server — always show the
  // loading shell.  The client will re-render immediately after mount
  // once localStorage is read and hydrated becomes true.
  if (typeof window === "undefined") {
    return <LoadingShell />;
  }

  // Wait for client hydration before deciding anything — prevents the
  // first-render redirect storm on refresh / deep-link.
  if (!hydrated) {
    return <LoadingShell />;
  }

  if (!isAuthenticated || !user) {
    // Only carry the redirect when it points at a real app surface — never
    // /auth/* (would create login→login loops) and never the bare root.
    const safe = pathname && !pathname.startsWith("/auth") && pathname !== "/";
    const target = safe
      ? `/auth/login?redirect=${encodeURIComponent(pathname + (search ?? ""))}`
      : "/auth/login";
    return <Navigate to={target as string} />;
  }

  const userPortal = portalForRole(user.role);
  const targetPortal = routePortal(pathname);
  const wrongPortal = !!(targetPortal && userPortal && targetPortal !== userPortal);
  const allowed = !wrongPortal && canAccessRoute(user.role, pathname);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 nc-scroll">
          {allowed ? <Outlet /> : <Unauthorized />}
        </main>
      </div>
    </div>
  );
}