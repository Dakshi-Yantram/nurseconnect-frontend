import { createFileRoute, Outlet, useRouter, useRouterState, Link } from "@tanstack/react-router";
import { QueuePanel } from "@/components/shared/QueuePanel";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { ModerationLifecycleStrip } from "@/components/journey/ModerationLifecycle";
import { useTransition, useModerationSnapshot } from "@/lib/orchestration";
import { useCompetencyReviewQueue, useReviewerCompetencyLifecycle } from "@/lib/competency";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/hooks/use-hydrated";
import { ShieldCheck, ClipboardCheck, AlertTriangle, GraduationCap, ArrowRight } from "lucide-react";

/**
 * Phase 6B+B — Reviewer / trainer moderation runtime.
 *
 * Surfaces queue-driven moderation visibility:
 *   - moderation queue (escalated bookings + incidents + complaints)
 *   - onboarding review queue (forward-compat; empty until partners submit)
 *   - SLA-breached items needing supervisor attention
 *
 * Actions still flow through executeTransition() — no direct repo writes.
 */
function ModerationErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error("[moderation] runtime error:", error);
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="text-[13px] flex-1">
          <div className="font-semibold">Moderation runtime hiccup</div>
          <div className="text-[12px] mt-0.5">The review queue couldn't finish loading. This is isolated to this view.</div>
          <button type="button"
            onClick={() => { router.invalidate(); reset(); }}
            className="mt-2 inline-flex items-center rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[12px] hover:bg-amber-100">
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/moderation")({
  component: ModerationPage,
  head: () => ({ meta: [{ title: "Review Queue — NurseConnect" }] }),
  errorComponent: ModerationErrorFallback,
  notFoundComponent: () => (
    <div className="text-[13px] text-muted-foreground">
      Moderation view not found. <Link to="/moderation" className="text-primary">Back to queue</Link>
    </div>
  ),
});

function ModerationPage() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (pathname !== "/moderation") return <Outlet />;
  return <ReviewQueue />;
}

function ReviewQueue() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  const actor = user?.email ?? "reviewer@nurseconnect.in";
  const transition = useTransition();
  const hydrated = useHydrated();
  const { moderation, lifecycle, counts } = useModerationSnapshot();
  const competencyQueue = useCompetencyReviewQueue();
  const trainerLifecycle = useReviewerCompetencyLifecycle();
  const isTrainer = role === "trainer";

  // Role-contextual chrome — reviewer = moderation-oriented,
  // trainer = competency-oriented (trainers normally land directly on
  // /moderation/training, but if they navigate to /moderation we still
  // present the surface in a competency-first frame).
  const chrome = isTrainer
    ? {
        icon: GraduationCap, tone: "bg-violet-100 text-violet-700",
        title: "Competency moderation",
        subtitle: "Training submissions and operational readiness signals routed for trainer review.",
      }
    : {
        icon: ShieldCheck, tone: "bg-amber-100 text-amber-700",
        title: "Moderation queue",
        subtitle: "Operational items routed for reviewer attention — escalations, incidents, complaints.",
      };
  const ChromeIcon = chrome.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md grid place-items-center ${chrome.tone}`}>
          <ChromeIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold">{chrome.title}</div>
          <div className="text-[12px] text-muted-foreground">{chrome.subtitle}</div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          {!isTrainer && (
            <Link to="/onboarding-review" className="text-primary hover:underline inline-flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" /> Onboarding reviews
            </Link>
          )}
          <Link to="/moderation/training" className="text-primary hover:underline inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" /> Training reviews →
          </Link>
        </div>
      </div>

      {isTrainer && (
        <Link to="/moderation/training"
          className="flex items-start gap-3 rounded-md border border-violet-200 bg-violet-50 text-violet-900 px-4 py-3 hover:bg-violet-100">
          <GraduationCap className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold">
              {competencyQueue.length} competency submission{competencyQueue.length === 1 ? "" : "s"} awaiting review
            </div>
            <div className="text-[12px]">Open the training queue to approve or return assessments.</div>
          </div>
          <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
        </Link>
      )}

      {hydrated && (
        isTrainer ? (
          <ModerationLifecycleStrip
            awaiting={trainerLifecycle.awaiting}
            decidedRecent={trainerLifecycle.decidedRecent}
            approvedRecent={trainerLifecycle.approvedRecent}
            rejectedRecent={trainerLifecycle.rejectedRecent}
            resubmissions={trainerLifecycle.resubmissions}
            lastDecisionAt={trainerLifecycle.lastDecisionAt}
            nextLabel="Competency decision"
          />
        ) : (
          <ModerationLifecycleStrip
            awaiting={counts.moderation}
            decidedRecent={lifecycle.decidedRecent}
            approvedRecent={lifecycle.approvedRecent}
            rejectedRecent={lifecycle.rejectedRecent}
            escalatedRecent={lifecycle.escalatedRecent}
            slaBreached={counts.slaBreached}
            lastDecisionAt={lifecycle.lastDecisionAt}
            nextLabel="Reviewer decision"
          />
        )
      )}


      {hydrated ? (
        <RuntimeBoundary label={isTrainer ? "Operational signals" : "Moderation queue"}>
          <QueuePanel
            name="moderation"
            title={isTrainer ? "Operational signals from the floor" : "Moderation queue"}
            limit={isTrainer ? 6 : 12}
            linkFor={(it) =>
              it.workflow === "incident"  ? `/incidents/${it.id}`  :
              it.workflow === "complaint" ? `/complaints/${it.id}` :
              undefined
            }
            renderActions={(it) =>
              !isTrainer && it.workflow === "booking" && it.state === "escalated" ? (
                <>
                  <WorkflowActionButton action="moderation.approve_submission" variant="secondary"
                    onClick={() => transition({
                      workflow: "booking", entityId: it.id, to: "in_progress",
                      actor, role, action: "moderation.approve_submission",
                      notes: "Reviewer cleared escalation",
                    }, { successMessage: `Cleared #${it.id}` })}>
                    Clear
                  </WorkflowActionButton>
                  <WorkflowActionButton action="moderation.reject_submission" variant="danger"
                    onClick={() => transition({
                      workflow: "booking", entityId: it.id, to: "cancelled",
                      actor, role, action: "moderation.reject_submission",
                      notes: "Reviewer cancelled booking",
                    }, { successMessage: `Cancelled #${it.id}` })}>
                    Cancel
                  </WorkflowActionButton>
                </>
              ) : null
            }
            emptyTitle={moderation.length === 0 ? "No items awaiting review" : undefined}
          />
        </RuntimeBoundary>
      ) : (
        <div className="rounded-md border border-border bg-card p-4 text-[12.5px] text-muted-foreground">
          Loading…
        </div>
      )}

      {/* Reviewer-only secondary lanes — onboarding review + SLA breach.
          Trainers don't moderate onboarding or operational SLAs, so we hide
          these surfaces to keep the trainer runtime competency-focused. */}
      {!isTrainer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RuntimeBoundary label="Onboarding queue">
            {hydrated
              ? <QueuePanel name="onboarding" title="Onboarding review queue" emptyTitle="No onboarding submissions" />
              : <div className="rounded-md border border-border bg-card p-4 text-[12.5px] text-muted-foreground">Loading…</div>}
          </RuntimeBoundary>
          <RuntimeBoundary label="SLA breached">
            {hydrated
              ? <QueuePanel name="sla_breached" title="SLA breached — needs attention" emptyTitle="No SLA breaches" />
              : <div className="rounded-md border border-border bg-card p-4 text-[12.5px] text-muted-foreground">Loading…</div>}
          </RuntimeBoundary>
        </div>
      )}
    </div>
  );
}
