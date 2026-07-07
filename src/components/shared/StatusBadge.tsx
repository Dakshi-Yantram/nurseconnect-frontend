import { StatusChip } from "./StatusChip";
import { getStatusMeta, type WorkflowKey } from "@/lib/workflows";

/**
 * Workflow-aware status badge.
 * Reads label + tone from the centralized workflow registry — pages must NOT
 * hardcode strings like "Resolved" or pick tones manually.
 */
export function StatusBadge({
  workflow, state, className,
}: { workflow: WorkflowKey; state: string; className?: string }) {
  const meta = getStatusMeta(workflow, state);
  if (!meta) return <StatusChip label={state} tone="muted" className={className} />;
  return <StatusChip label={meta.label} tone={meta.tone} className={className} dot />;
}
