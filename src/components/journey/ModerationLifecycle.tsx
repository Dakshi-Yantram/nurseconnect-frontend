/**
 * Phase 8F — Moderation lifecycle continuity strip.
 *
 * Lightweight presentational rollup that makes reviewer/trainer surfaces
 * feel longitudinal instead of queue-snapshot-oriented. Renders three
 * operational reference points around the *current* awaiting queue:
 *
 *   prior decisions (recent)  →  now awaiting  →  next moderation focus
 *
 * Plus an inline continuity chip for escalations / SLA breaches /
 * resubmissions so interruption history stays visible across the lifecycle.
 *
 * Pure presentation — consumers pass in derived counts.
 */
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, AlertOctagon, RotateCcw, History } from "lucide-react";

interface Props {
  /** Required headline counts. */
  awaiting: number;
  decidedRecent: number;
  /** Optional continuity signals — rendered as chips when > 0. */
  approvedRecent?: number;
  rejectedRecent?: number;
  escalatedRecent?: number;
  resubmissions?: number;
  slaBreached?: number;
  /** Optional "next" milestone label — defaults to a moderation hint. */
  nextLabel?: string;
  /** Last decision timestamp (ISO) — rendered as short relative meta. */
  lastDecisionAt?: string;
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

export function ModerationLifecycleStrip({
  awaiting, decidedRecent,
  approvedRecent = 0, rejectedRecent = 0,
  escalatedRecent = 0, resubmissions = 0, slaBreached = 0,
  nextLabel = "Reviewer decision",
  lastDecisionAt,
  className,
}: Props) {
  const lastMeta = shortTime(lastDecisionAt);
  return (
    <div className={cn(
      "rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] flex flex-wrap items-center gap-x-2 gap-y-1",
      className,
    )}>
      <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">Prior 24h</span>
      <span className="font-medium text-foreground/80">
        {decidedRecent} decision{decidedRecent === 1 ? "" : "s"}
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">Now</span>
      <span className="font-semibold text-foreground">
        {awaiting} awaiting
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">Next</span>
      <span className="font-medium text-foreground/80">{nextLabel}</span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {approvedRecent > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <CheckCircle2 className="h-3 w-3" /> {approvedRecent} cleared
          </span>
        )}
        {rejectedRecent > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <AlertOctagon className="h-3 w-3" /> {rejectedRecent} returned
          </span>
        )}
        {escalatedRecent > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <AlertOctagon className="h-3 w-3" /> {escalatedRecent} escalated
          </span>
        )}
        {resubmissions > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <RotateCcw className="h-3 w-3" /> {resubmissions} resubmitted
          </span>
        )}
        {slaBreached > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
            <AlertOctagon className="h-3 w-3" /> {slaBreached} SLA
          </span>
        )}
        {lastMeta && (
          <span className="text-[10.5px] text-muted-foreground">
            last decision · {lastMeta}
          </span>
        )}
      </div>
    </div>
  );
}
