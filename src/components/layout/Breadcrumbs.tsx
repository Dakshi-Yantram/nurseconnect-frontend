import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { routeMeta, portalHome } from "@/lib/rbac";
import { useAuth } from "@/lib/auth-context";

/**
 * Route-derived breadcrumbs.
 * Reads the active pathname, maps it against the centralized NAV registry
 * and renders section › page › (detail id) automatically.
 */
export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const home = portalHome(user?.role ?? null);
  const segments = pathname.split("/").filter(Boolean);
  const meta = routeMeta(pathname);

  // Detect detail segment (anything after the matched nav page).
  const detail = segments.length >= 2 ? decodeURIComponent(segments[segments.length - 1]) : null;
  const isDetail = detail && segments.length > 1 && !!meta.section;

  return (
    <nav aria-label="Breadcrumb" className="text-[11px] text-muted-foreground flex items-center gap-1.5">
      <Link to={home} className="inline-flex items-center gap-1 hover:text-foreground">
        <Home className="h-3 w-3" />
      </Link>
      {meta.section && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span>{meta.section}</span>
        </>
      )}
      <ChevronRight className="h-3 w-3" />
      <span className={isDetail ? "" : "text-foreground font-medium"}>{meta.title}</span>
      {isDetail && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium truncate max-w-[180px]">{detail}</span>
        </>
      )}
    </nav>
  );
}
