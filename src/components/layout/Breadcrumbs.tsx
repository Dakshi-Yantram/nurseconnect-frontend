import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { routeMeta, portalHome } from "@/lib/rbac";
import { useAuth } from "@/lib/auth-context";
import { useBookings } from "@/lib/domain";
import { bookingRef } from "@/lib/booking-view";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Never show a raw UUID in the breadcrumb: use the booking reference instead. */
function DetailLabel({ id }: { id: string }) {
  const bookings = useBookings();
  if (!UUID.test(id)) return <>{id}</>;
  const b = bookings.find((x) => x.id === id);
  return <>{b ? bookingRef(b) : "Details"}</>;
}

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
          <span className="text-foreground font-medium truncate max-w-[180px]"><DetailLabel id={detail!} /></span>
        </>
      )}
    </nav>
  );
}
