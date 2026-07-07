/**
 * Phase 8E — Visit lifecycle continuity strip.
 *
 * Purely presentational rollup that makes worker execution feel longitudinal
 * instead of snapshot-based. Renders three operational reference points
 * around the *current* execution stage:
 *
 *   prior stage  →  current stage  →  next likely milestone
 *
 * Plus an inline escalation continuity chip when the visit has been
 * escalated before (currently or historically) so interruption history
 * stays visible across the rest of the lifecycle.
 *
 * Source-of-truth is `useVisitLifecycle()` — this component never reads
 * from the repository directly.
 */
import { cn } from "@/lib/utils";
import {
  PROGRESSION_ORDER, progressIndex,
  type ExecutionStage, type ExecutionStageKey,
} from "@/lib/execution-stage";
import { AlertOctagon, ArrowRight, History } from "lucide-react";

interface Props {
  stage: ExecutionStage | null;
  priorStage?: string;
  escalation: {
    active: boolean;
    priorCount: number;
    lastAt?: string;
    resumed: boolean;
  };
}

const STAGE_LABEL: Partial<Record<string, string>> = {
  claimed: "Claim",
  ready_for_visit: "Travel",
  in_progress: "Execute",
  ready_for_completion: "Verify",
  completed: "Closed",
  pending: "Open",
  escalated: "Escalated",
  active: "Travel",
};

function nextMilestoneLabel(key: ExecutionStageKey | undefined): string | null {
  if (!key) return null;
  const i = progressIndex(key);
  if (i < 0 || i >= PROGRESSION_ORDER.length - 1) return null;
  return STAGE_LABEL[PROGRESSION_ORDER[i + 1]] ?? null;
}

export function LifecycleContinuityStrip({ stage, priorStage, escalation }: Props) {
  if (!stage) return null;
  const next = nextMilestoneLabel(stage.key);
  const priorLabel = priorStage ? (STAGE_LABEL[priorStage] ?? priorStage) : null;

  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-2 gap-y-1">
      <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {priorLabel && (
        <>
          <span className="text-muted-foreground">From</span>
          <span className="font-medium text-foreground/80">{priorLabel}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </>
      )}
      <span className="text-muted-foreground">Now</span>
      <span className="font-semibold text-foreground">{stage.label}</span>
      {next && (
        <>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Next</span>
          <span className="font-medium text-foreground/80">{next}</span>
        </>
      )}

      {(escalation.active || escalation.priorCount > 0) && (
        <span className={cn(
          "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
          escalation.active
            ? "bg-rose-50 text-rose-700"
            : "bg-amber-50 text-amber-800",
        )}>
          <AlertOctagon className="h-3 w-3" />
          {escalation.active
            ? `Escalation active${escalation.priorCount > 1 ? ` · ${escalation.priorCount}×` : ""}`
            : `Previously escalated · resumed`}
        </span>
      )}
    </div>
  );
}
