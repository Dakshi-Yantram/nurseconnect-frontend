import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PortalBadge } from "@/components/shared/PortalBadge";
import { useRouterState } from "@tanstack/react-router";
import { routeMeta } from "@/lib/rbac";
import type { ComponentType } from "react";

/**
 * Phase-2 placeholder for portal sub-routes whose full workflow UI lands in
 * the next phase. Renders the canonical empty-state inside the standard shell
 * so navigation never breaks and breadcrumbs / route metadata stay correct.
 */
export function PortalPlaceholder({
  icon, description,
}: { icon?: ComponentType<{ className?: string }>; description?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const meta = routeMeta(path);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold text-foreground">{meta.title}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {description ?? "Workflow UI for this module arrives in the next phase."}
          </div>
        </div>
        {meta.portal && <PortalBadge portal={meta.portal} />}
      </div>
      <Card>
        <EmptyState
          icon={icon}
          title={`${meta.title} — coming next phase`}
          description="The route, permissions and workflow registry are wired. Screens will land with the next phase of work."
        />
      </Card>
    </div>
  );
}
