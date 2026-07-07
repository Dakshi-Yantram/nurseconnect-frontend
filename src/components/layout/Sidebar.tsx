import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import logo from "@/assets/yantram-logo.jpg";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { NAV_SECTIONS, navForRole } from "@/lib/rbac";

type SidebarProps = {
  /** Whether the mobile drawer is open. Ignored on lg+ screens. */
  mobileOpen?: boolean;
  /** Called to close the mobile drawer (backdrop click, nav click, X button). */
  onCloseMobile?: () => void;
};

/**
 * Role-aware sidebar. Navigation comes from the centralized registry
 * (`src/lib/rbac.ts`) and is filtered by the current user's permissions.
 *
 * Responsive behavior:
 *  - lg and up: static column, part of the normal flex layout (unchanged).
 *  - below lg: fixed off-canvas drawer, translated out of view by default
 *    and slid in over a backdrop when `mobileOpen` is true. This prevents
 *    the sidebar from permanently squeezing page content on phones.
 */
export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const items = navForRole(user?.role ?? null);

  /**
   * Find the single best-matching nav item for the current path.
   *
   * Rules:
   *  1. Exact match always wins (e.g. path === "/worker" → Workspace active).
   *  2. Prefix match only counts when the nav item has MORE than one path
   *     segment — so "/worker" (1 segment) never prefix-matches "/worker/visits".
   *     But "/worker/visits" (2 segments) DOES prefix-match "/worker/visits/123".
   *  3. Among multiple valid prefix matches the longest wins (most specific).
   *
   * This prevents Workspace (/worker) from lighting up whenever any
   * /worker/* sub-page is active.
   */
  const bestMatch =
    items
      .filter((item) => {
        if (path === item.to) return true;
        const segmentCount = item.to.split("/").filter(Boolean).length;
        return segmentCount > 1 && path.startsWith(item.to + "/");
      })
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? null;

  return (
    <>
      {/* Mobile-only backdrop, shown behind the drawer while it's open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "nc-sidebar-bg flex flex-col text-sidebar-foreground transition-all duration-200 shrink-0",
          // Mobile: fixed off-canvas drawer, slides in from the left.
          "fixed inset-y-0 left-0 z-40 h-dvh w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop (lg+): back to a normal static column, always visible.
          "lg:sticky lg:top-0 lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[220px] xl:w-[260px]"
        )}
      >
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
        <img
          src={logo}
          alt="Yantram"
          className="h-9 w-9 rounded-md bg-white/95 p-0.5 object-contain shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight">NurseConnect</div>
            <div className="text-[11px] text-sidebar-muted">Yantram Healthcare Ops</div>
          </div>
        )}
        {/* Close button only makes sense on the mobile drawer */}
        <button
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="lg:hidden ml-auto h-8 w-8 grid place-items-center rounded-md hover:bg-white/10 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto nc-scroll px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter((n) => n.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-sidebar-muted font-semibold">
                  {section}
                </div>
              )}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => {
                  const active = item.to === bestMatch;
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onCloseMobile}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                          active
                            ? "bg-[var(--sidebar-active)] text-white"
                            : "text-sidebar-muted hover:bg-white/5 hover:text-white"
                        )}
                        title={item.label}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2 space-y-1">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* ✅ Fix: use button + navigate instead of Link to avoid missing `search` type error */}
        <button
          onClick={() => {
            signOut();
            window.location.href = "/auth/login";
          }}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-muted hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
      </aside>
    </>
  );
}