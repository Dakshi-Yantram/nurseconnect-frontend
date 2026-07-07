/**
 * Phase 9A — Admin operational command-center lifecycle strip.
 *
 * Presentational rollup that makes the admin ops surface feel longitudinal
 * (coordinated healthcare operations command center) instead of an
 * ERP-style module grid of isolated queue cards.
 *
 *   prior 24h interventions  →  now actionable  →  next operational focus
 *
 * Continuity chips highlight urgent / breached / escalated / recovered /
 * dispatch-in-flight signals so admin operators see operational recovery
 * state, not just a static count of open items.
 *
 * Pure presentation — consumers pass in derived counts (typically from
 * `useAdminOperationsSnapshot()`).
 */
import { cn } from "@/lib/utils";
import {
  ArrowRight, AlertOctagon, Clock, History, RotateCcw, ShieldAlert, Activity,
} from "lucide-react";

interface Props {
  actionable: number;
  decidedRecent: number;
  urgent?: number;
  breached?: number;
  activeEscalations?: number;
  recoveredEscalations?: number;
  dispatchInFlight?: number;
  nextLabel?: string;
  lastInterventionAt?: string;
  className?: string;
}

function shortTime(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function OperationsLifecycleStrip({
  actionable, decidedRecent,
  urgent = 0, breached = 0,
  activeEscalations = 0, recoveredEscalations = 0,
  dispatchInFlight = 0,
  nextLabel = "Operator dispatch",
  lastInterventionAt,
  className,
}: Props) {
  const lastMeta = shortTime(lastInterventionAt);
  return (
    <div className={cn(
      "rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-2 gap-y-1",
      className,
    )}>
      <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">Prior 24h</span>
      <span className="font-medium text-foreground/80">
        {decidedRecent} intervention{decidedRecent === 1 ? "" : "s"}
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">Now</span>
      <span className="font-semibold text-foreground">
        {actionable} actionable
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">Next</span>
      <span className="font-medium text-foreground/80">{nextLabel}</span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {urgent > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <AlertOctagon className="h-3 w-3" /> {urgent} urgent
          </span>
        )}
        {breached > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <Clock className="h-3 w-3" /> {breached} SLA
          </span>
        )}
        {activeEscalations > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <ShieldAlert className="h-3 w-3" /> {activeEscalations} escalated
          </span>
        )}
        {recoveredEscalations > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <RotateCcw className="h-3 w-3" /> {recoveredEscalations} recovered
          </span>
        )}
        {dispatchInFlight > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-sky-50 text-sky-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <Activity className="h-3 w-3" /> {dispatchInFlight} dispatching
          </span>
        )}
        {lastMeta && (
          <span className="text-[10.5px] text-muted-foreground">
            last action · {lastMeta}
          </span>
        )}
      </div>
    </div>
  );
}
