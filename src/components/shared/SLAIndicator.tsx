import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { slaRemainingMinutes, type WorkflowKey } from "@/lib/workflows";

/**
 * Renders the remaining SLA window for a workflow state.
 * Tone shifts as the deadline approaches; breach renders in danger tone.
 */
export function SLAIndicator({
  workflow, state, enteredAt, className,
}: { workflow: WorkflowKey; state: string; enteredAt: Date; className?: string }) {
  const mins = slaRemainingMinutes(workflow, state, enteredAt);
  if (mins === null) return null;

  const breached = mins <= 0;
  const warning = !breached && mins <= 30;
  const tone = breached ? "text-rose-700 bg-rose-50 border-rose-200"
             : warning  ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-slate-600 bg-slate-100 border-slate-200";

  const label = breached
    ? `Overdue ${Math.abs(mins)}m`
    : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m left`
                 : `${mins}m left`;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums",
      tone, className,
    )}
    title={breached ? "SLA breached" : warning ? "SLA approaching" : "Within SLA"}>
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
