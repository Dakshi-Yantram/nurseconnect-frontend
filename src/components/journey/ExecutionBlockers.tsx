/**
 * Phase 7D + 8E — Operational blocker rendering refinement.
 *
 * Pure presentation layer that derives the list of *currently blocking*
 * operational requirements for a booking record and renders them as a
 * contextual strip. No new state, no engine changes — mirrors the same
 * guard semantics already enforced by the orchestration engine so workers
 * understand exactly which readiness items are gating the next transition.
 *
 * Phase 8E refinement — optional lifecycle context lets the blocker strip
 * render completion-readiness as a small operational header ("2 of 3 ready
 * · 1 blocker remaining") and a "previously escalated · resumed" note so
 * interruption history stays visible across the rest of the visit.
 *
 * Intentionally scoped to a single workflow (booking) and a small fixed set
 * of readiness flags. Wrap in <RuntimeBoundary> at the call site for safe
 * degradation.
 */
import type { EntityRecord } from "@/lib/orchestration/repositories";
import { deriveExecutionStage } from "@/lib/execution-stage";
import {
  ShieldCheck, ClipboardList, FileText,
  AlertOctagon, CheckCircle2, History, type LucideIcon,
} from "lucide-react";
import { bindStatus } from "@/lib/workflow-bind";
type Blocker = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: "warning" | "danger";
};

export interface BlockerLifecycleContext {
  completion?: { met: number; total: number; remaining: string[]; ready: boolean };
  escalation?: { active: boolean; priorCount: number; resumed: boolean };
}

function deriveBlockers(rec: EntityRecord | undefined | null): Blocker[] {
  if (!rec) return [];
  const d: any = rec.data ?? {};
  const list: Blocker[] = [];

  const state = bindStatus("booking", rec.state);

  if (state === "pending" || state === "completed" || state === "cancelled") {
    return list;
  }

  if (state === "escalated") {
    list.push({
      key: "escalation",
      label: "Escalation active",
      hint: "Awaiting clinical/ops resolution before further execution.",
      icon: AlertOctagon, tone: "danger",
    });
    return list;
  }

  if (!d.consentAccepted && !d.consent_accepted) {

    list.push({
      key: "consent",
      label: "Patient consent pending",
      hint: "Confirm consent on arrival before checking in.",
      icon: ShieldCheck, tone: "warning",
    });
  }
  if (rec.state === "in_progress" && !d.checklistComplete) {
    list.push({
      key: "checklist",
      label: "Clinical checklist incomplete",
      hint: "Complete the clinical checklist to enable checkout.",
      icon: ClipboardList, tone: "warning",
    });
  }
  if (rec.state === "in_progress" && !d.documentationComplete) {
    list.push({
      key: "documentation",
      label: "Visit documentation pending",
      hint: "Submit visit documentation to enable checkout.",
      icon: FileText, tone: "warning",
    });
  }
  return list;
}

const TONE: Record<Blocker["tone"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger:  "border-rose-200 bg-rose-50 text-rose-800",
};

export function ExecutionBlockers({
  rec, lifecycle,
}: { rec: EntityRecord | undefined | null; lifecycle?: BlockerLifecycleContext }) {
  if (!rec) return null;
  const blockers = deriveBlockers(rec);
  const stage = deriveExecutionStage(rec);
  const completion = lifecycle?.completion;
  const escalation = lifecycle?.escalation;
  const showResumed =
    escalation && !escalation.active && escalation.priorCount > 0 && escalation.resumed;

  // Lifecycle-aware completion-readiness header. Only meaningful once the
  // visit is operationally in-flight (claimed → in_progress); skipped for
  // pending/completed/cancelled to avoid noise.
  const showCompletionHeader =
    completion &&
    rec.state !== "pending" &&
    rec.state !== "completed" &&
    rec.state !== "cancelled";

  if (blockers.length === 0) {
    if (stage.key === "ready_for_completion") {
      return (
        <div className="space-y-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-[12.5px] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Ready to check out</div>
              <div className="text-[12px] opacity-90">
                {completion
                  ? `All ${completion.total} readiness checks satisfied — close the visit when ready.`
                  : "All readiness checks satisfied — close the visit when ready."}
              </div>
            </div>
          </div>
          {showResumed && <ResumedNote priorCount={escalation!.priorCount} />}
        </div>
      );
    }
    if (showResumed) {
      return <ResumedNote priorCount={escalation!.priorCount} />;
    }
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Operational blockers
        </div>
        {showCompletionHeader && (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">
              {completion!.met}/{completion!.total}
            </span>{" "}
            ready ·{" "}
            <span className="font-medium text-amber-700">
              {completion!.total - completion!.met} remaining
            </span>
          </div>
        )}
      </div>
      <ul className="space-y-1.5">
        {blockers.map(b => (
          <li key={b.key}
            className={`rounded-md border px-3 py-2 text-[12.5px] flex items-start gap-2 ${TONE[b.tone]}`}>
            <b.icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">{b.label}</div>
              <div className="text-[12px] opacity-90">{b.hint}</div>
            </div>
          </li>
        ))}
      </ul>
      {showResumed && <ResumedNote priorCount={escalation!.priorCount} />}
    </div>
  );
}

function ResumedNote({ priorCount }: { priorCount: number }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-[12px] flex items-start gap-2">
      <History className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">Previously escalated · resumed.</span>{" "}
        <span className="opacity-90">
          This visit has {priorCount === 1 ? "1 prior escalation" : `${priorCount} prior escalations`} in its lifecycle —
          confirm continuity of care before closing.
        </span>
      </div>
    </div>
  );
}
