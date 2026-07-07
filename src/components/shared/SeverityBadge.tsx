import { StatusChip } from "./StatusChip";
import { cn } from "@/lib/utils";
import { SEVERITY_META, PRIORITY_META, type Severity, type Priority } from "@/lib/workflows";

/**
 * Severity visual hierarchy:
 * - critical → strong ring + uppercase + bold for ops-floor visibility
 * - high     → bold weight
 * - medium   → standard chip
 * - low      → muted chip
 */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const m = SEVERITY_META[severity];
  const emphasis =
    severity === "critical" ? "uppercase tracking-wide font-bold ring-1 ring-rose-300/70"
    : severity === "high"   ? "font-semibold"
    : "";
  return <StatusChip label={m.label} tone={m.tone} className={cn(emphasis, className)} dot />;
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const m = PRIORITY_META[priority];
  const emphasis = priority === "urgent" ? "uppercase tracking-wide font-bold ring-1 ring-rose-300/70" : "";
  return <StatusChip label={m.label} tone={m.tone} className={cn(emphasis, className)} />;
}

