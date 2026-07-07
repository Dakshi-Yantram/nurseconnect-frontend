import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusChip } from "@/components/shared/StatusChip";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { ModerationLifecycleStrip } from "@/components/journey/ModerationLifecycle";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  useCompetencyReviewQueue, useCompetencyActions, useReviewerCompetencyLifecycle,
  getCourse,
} from "@/lib/competency";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft, Check, X, AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Phase 7A — Reviewer / trainer competency orchestration.
 *
 * Surfaces submitted competency assessments. Approving an assessment updates
 * the worker's eligibility immediately (gates the claim affordance in the
 * worker portal). Rejection re-opens the assessment for resubmission.
 */
function TrainingReviewsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error("[moderation/training] runtime error:", error);
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-4 text-[13px]">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Training reviews unavailable</div>
          <div className="text-[12px] mt-0.5">The competency runtime didn't initialize cleanly.</div>
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

export const Route = createFileRoute("/_app/moderation/training")({
  component: TrainingReviewsPage,
  head: () => ({ meta: [{ title: "Training Reviews — NurseConnect" }] }),
  errorComponent: TrainingReviewsError,
  notFoundComponent: () => (
    <div className="text-[13px] text-muted-foreground">
      Review not found. <Link to="/moderation/training" className="text-primary">Back to training reviews</Link>
    </div>
  ),
});

function TrainingReviewsPage() {
  const { user } = useAuth();
  const reviewer = user?.email ?? "trainer@nurseconnect.in";
  const isTrainer = user?.role === "trainer";
  const hydrated = useHydrated();
  const queueForHeader = useCompetencyReviewQueue();

  return (
    <div className="space-y-4">
      {/* Trainers land here directly — no "back to moderation" affordance.
          Reviewers reach this page via the moderation queue link and keep
          the back navigation. Keeps each role's runtime feel contextual. */}
      {!isTrainer && (
        <Link to="/moderation" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to moderation
        </Link>
      )}

      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-violet-100 text-violet-700 grid place-items-center">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold">
            {isTrainer ? "Competency reviews" : "Training reviews"}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {isTrainer
              ? "Assess submitted coursework and unlock operational readiness for care professionals."
              : "Submitted coursework awaiting approval."}
          </div>
        </div>
        <div className="ml-auto text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{queueForHeader.length}</span> awaiting review
        </div>
      </div>

      {hydrated && <TrainerLifecycleBar />}

      <RuntimeBoundary label="Competency review queue">
        {hydrated
          ? <CompetencyReviewQueue reviewer={reviewer} />
          : <Card title="Competency review queue">
              <div className="text-[12.5px] text-muted-foreground">Loading reviewer queue…</div>
            </Card>}
      </RuntimeBoundary>
    </div>
  );
}

function TrainerLifecycleBar() {
  const lc = useReviewerCompetencyLifecycle();
  return (
    <ModerationLifecycleStrip
      awaiting={lc.awaiting}
      decidedRecent={lc.decidedRecent}
      approvedRecent={lc.approvedRecent}
      rejectedRecent={lc.rejectedRecent}
      resubmissions={lc.resubmissions}
      lastDecisionAt={lc.lastDecisionAt}
      nextLabel="Competency decision"
    />
  );
}

function CompetencyReviewQueue({ reviewer }: { reviewer: string }) {
  const queue = useCompetencyReviewQueue();
  const { approve, reject } = useCompetencyActions();
  return (
    <Card title="Competency review queue" padded={false}
      action={<GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />}>
      {queue.length === 0
        ? <div className="p-5"><EmptyState icon={GraduationCap}
            title="No competency submissions waiting"
            description="Submitted coursework from care professionals will appear here." /></div>
        : queue.map(e => {
            const c = getCourse(e.courseId);
            const prior = e.priorDecisions ?? [];
            const lastPrior = prior[0];
            const resubmitted = (e.submissionCount ?? 0) > 1 || prior.length > 0;
            return (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium flex items-center gap-2">
                    {c?.title ?? e.courseId}
                    {c?.required && <span className="text-[10px] uppercase tracking-wide text-amber-700">required</span>}
                    {resubmitted && (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        <RotateCcw className="h-3 w-3" />
                        Resubmission #{e.submissionCount ?? prior.length + 1}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Worker: {e.workerName} · Submitted {new Date(e.updatedAt).toLocaleString()}
                  </div>
                  {lastPrior && (
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      Prior decision:{" "}
                      <span className={lastPrior.status === "rejected" ? "text-rose-700 font-medium" : "text-emerald-700 font-medium"}>
                        {lastPrior.status}
                      </span>
                      {lastPrior.reviewer ? ` · ${lastPrior.reviewer}` : ""}
                      {lastPrior.notes ? ` — ${lastPrior.notes}` : ""}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusChip tone="info" label="Awaiting review" dot />
                  <button type="button"
                    onClick={() => { approve(e.id, reviewer); toast.success(`Approved ${c?.title ?? e.courseId}`); }}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[12px] hover:bg-emerald-100">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button type="button"
                    onClick={() => { reject(e.id, reviewer); toast.message(`Rejected ${c?.title ?? e.courseId}`); }}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 text-rose-700 px-2.5 py-1 text-[12px] hover:bg-rose-100">
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
    </Card>
  );
}
