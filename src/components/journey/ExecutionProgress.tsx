/**
 * Phase 7A — Guided execution progression strip.
 *
 * Renders the operational journey for a single visit so workers can see
 * which milestone is active and what's blocking the next transition.
 */
import { cn } from "@/lib/utils";
import {
  deriveExecutionStage, progressIndex, PROGRESSION_ORDER,
  type ExecutionStage,
} from "@/lib/execution-stage";
import type { EntityRecord } from "@/lib/orchestration/repositories";
import { Check } from "lucide-react";

const TONE: Record<ExecutionStage["tone"], string> = {
  muted:   "bg-muted text-muted-foreground border-border",
  info:    "bg-sky-50 text-sky-700 border-sky-200",
  primary: "bg-primary/10 text-primary border-primary/30",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger:  "bg-rose-50 text-rose-700 border-rose-200",
};

const MILESTONE_LABEL: Partial<Record<string, string>> = {
  claimed: "Claim",
  ready_for_visit: "Travel",
  in_progress: "Execute",
  ready_for_completion: "Verify",
  completed: "Closed",
};

export function ExecutionProgress({ rec }: { rec: EntityRecord | undefined | null }) {
  const stage = deriveExecutionStage(rec);
  const idx   = progressIndex(stage.key);

  return (
    <div className="space-y-3">
      <div className={cn(
        "rounded-md border px-3 py-2 text-[12.5px] flex items-start gap-2",
        TONE[stage.tone],
      )}>
        <div className="font-semibold whitespace-nowrap">{stage.label}</div>
        <div className="text-[12px] opacity-90">— {stage.description}</div>
      </div>

      <ol className="flex items-center gap-1">
        {PROGRESSION_ORDER.map((m, i) => {
          const done = idx > i;
          const active = idx === i;
          return (
            <li key={m} className="flex-1 flex items-center gap-1 min-w-0">
              <div className={cn(
                "h-6 w-6 shrink-0 grid place-items-center rounded-full border text-[11px] font-semibold",
                done   ? "bg-emerald-500 border-emerald-500 text-white" :
                active ? "bg-primary border-primary text-primary-foreground" :
                         "bg-muted border-border text-muted-foreground",
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div className={cn(
                "text-[11px] truncate",
                done || active ? "text-foreground font-medium" : "text-muted-foreground",
              )}>{MILESTONE_LABEL[m]}</div>
              {i < PROGRESSION_ORDER.length - 1 && (
                <div className={cn(
                  "flex-1 h-px",
                  done ? "bg-emerald-500" : "bg-border",
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
