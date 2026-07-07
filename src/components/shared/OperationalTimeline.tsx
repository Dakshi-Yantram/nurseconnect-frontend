/**
 * Phase 4 — Reusable OperationalTimeline.
 *
 * Renders the lifecycle of any (workflow, entityId) pair by pulling from the
 * orchestration history store. Screens get history "for free" without
 * maintaining their own state.
 */
import { useEntityHistory } from "@/lib/orchestration";
import { Timeline, type TimelineItem } from "@/components/shared/Timeline";
import { EmptyState } from "@/components/shared/EmptyState";
import type { WorkflowKey } from "@/lib/workflows";

export function OperationalTimeline({
  workflow, entityId, limit,
}: { workflow: WorkflowKey; entityId: string; limit?: number }) {
  const entries = useEntityHistory(workflow, entityId);
  if (entries.length === 0) {
    return <EmptyState title="No operational history" description="Events will appear as the entity progresses." />;
  }
  const items: TimelineItem[] = entries.slice(0, limit ?? 50).map(e => ({
    ts: new Date(e.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    title: e.title,
    meta: e.notes ?? e.meta ?? e.actor,
    tone: e.tone === "info" ? "primary" : e.tone,
  }));
  return <Timeline items={items} />;
}
