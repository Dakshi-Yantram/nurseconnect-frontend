import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useWorkerEnrollments,
  useWorkerEligibility,
  useCompetencyActions,
  getCourse,
  type CompetencyStatus,
} from "@/lib/competency";
import {
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "pending" | "in_review" | "approved" | "rejected";

type Enrollment = ReturnType<typeof useWorkerEnrollments>[number];

type Blocker = {
  courseId: string;
  title: string;
  status: CompetencyStatus;
};

type EligibilityResult = ReturnType<typeof useWorkerEligibility>;

// ─── Route ────────────────────────────────────────────────────────────────────

function WorkerTrainingError({ error: _error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 p-5 text-[13px]">
      <div className="font-semibold">Training surface didn't load</div>
      <div className="text-[12px] mt-0.5 text-amber-700">Competency runtime hit a hiccup.</div>
      <button
        type="button"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-amber-100 transition-colors"
      >
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

export const Route = createFileRoute("/_app/worker/training")({
  component: WorkerTraining,
  head: () => ({ meta: [{ title: "Training — NurseConnect" }] }),
  errorComponent: WorkerTrainingError,
});

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CompetencyStatus,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Approved",
  },
  submitted: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
    label: "Awaiting Review",
  },
  pending: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-400",
    label: "Not Started",
  },
  rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    label: "Resubmit Required",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CompetencyStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-[3px] rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-[6px] w-[6px] rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function EligibilitySection({ eligibility }: { eligibility: EligibilityResult }) {
  const pct =
    eligibility.total > 0
      ? Math.round((eligibility.approved / eligibility.total) * 100)
      : 0;
  const isComplete = eligibility.eligible;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isComplete ? "bg-emerald-50 border-emerald-200" : "bg-white border-border"
      }`}
      style={{ boxShadow: "0 1px 8px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-xl grid place-items-center ${
              isComplete
                ? "bg-emerald-100 text-emerald-600"
                : "bg-orange-100 text-orange-500"
            }`}
          >
            {isComplete ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">
              {isComplete ? "Fully Eligible" : "Eligibility Incomplete"}
            </div>
            <div className="text-[11.5px] text-muted-foreground">Operational status</div>
          </div>
        </div>
        <div
          className={`text-[22px] font-bold tabular-nums ${
            isComplete ? "text-emerald-600" : "text-orange-500"
          }`}
        >
          {pct}%
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isComplete ? "bg-emerald-500" : "bg-orange-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-[11.5px] text-muted-foreground mb-3">
        {eligibility.approved} of {eligibility.total} required competencies approved
      </div>

      {!isComplete && eligibility.blockers.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Missing
          </div>
          {eligibility.blockers.map((b: Blocker) => (
            <div
              key={b.courseId}
              className="flex items-center justify-between gap-2 rounded-xl bg-white border border-border px-3 py-2"
            >
              <span className="text-[12px] font-medium text-foreground truncate">
                {b.title}
              </span>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      )}

      {isComplete && (
        <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 font-medium mt-1">
          <Sparkles className="h-3.5 w-3.5" />
          You can claim assignments on the marketplace
        </div>
      )}
    </div>
  );
}

function CourseCard({
  enrollment,
  onSubmit,
}: {
  enrollment: Enrollment;
  onSubmit: () => void;
}) {
  const course = getCourse(enrollment.courseId);
  if (!course) return null;

  const canSubmit =
    enrollment.status === "pending" || enrollment.status === "rejected";

  return (
    <div
      className="group bg-white rounded-[20px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)]"
      style={{ border: "1px solid #EAEAEA", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
    >
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="h-[38px] w-[38px] rounded-[10px] bg-orange-50 flex items-center justify-center shrink-0">
            <GraduationCap className="h-[18px] w-[18px] text-orange-500" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-medium text-foreground leading-snug">
                {course.title}
              </span>
              {course.required && (
                <span className="text-[10px] font-medium tracking-wide px-[7px] py-[2px] rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Required
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground leading-[1.55] mb-2.5">
          {course.summary}
          {enrollment.notes && enrollment.status === "rejected" && (
            <span className="block mt-1 text-[11.5px] text-rose-600">
              Reviewer: {enrollment.notes}
            </span>
          )}
        </p>

        <div className="flex items-center justify-between gap-2 flex-wrap pb-3.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Clock className="h-[13px] w-[13px]" />
              {course.duration}
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground/60 bg-gray-50 border border-gray-200 px-1.5 py-[2px] rounded-[5px]">
              {course.id}
            </span>
          </div>
          <StatusBadge status={enrollment.status} />
        </div>
      </div>

      {canSubmit && (
        <>
          <div className="h-px bg-gray-100 mx-4" />
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={onSubmit}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[13px] font-medium py-2.5 flex items-center justify-center gap-1.5 transition-all duration-150"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark as complete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Not Started" },
    { key: "in_review", label: "In Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
            active === t.key
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
          {counts[t.key] > 0 && (
            <span
              className={`ml-1 text-[10px] px-1 rounded-full ${
                active === t.key
                  ? "bg-gray-100 text-muted-foreground"
                  : "bg-gray-200 text-muted-foreground"
              }`}
            >
              {counts[t.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function WorkerTraining() {
  const { user } = useAuth();
  const workerId = user?.id ?? "worker-anon";
  const workerName = user?.name ?? "Demo Worker";

  const enrollments = useWorkerEnrollments(workerId, workerName);
  const eligibility = useWorkerEligibility(workerId, workerName);
  const { submit, approve } = useCompetencyActions();

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const counts: Record<FilterTab, number> = {
    all: enrollments.length,
    pending: enrollments.filter((e: Enrollment) => e.status === "pending").length,
    in_review: enrollments.filter((e: Enrollment) => e.status === "submitted").length,
    approved: enrollments.filter((e: Enrollment) => e.status === "approved").length,
    rejected: enrollments.filter((e: Enrollment) => e.status === "rejected").length,
  };

  const filtered = enrollments.filter((e: Enrollment) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return e.status === "pending";
    if (activeFilter === "in_review") return e.status === "submitted";
    if (activeFilter === "approved") return e.status === "approved";
    if (activeFilter === "rejected") return e.status === "rejected";
    return true;
  });

  const approvedCount = enrollments.filter(
    (e: Enrollment) => e.status === "approved"
  ).length;

  const handleComplete = (courseId: string) => {
    submit(workerId, workerName, courseId);
    const enrollmentId = `${workerId}:${courseId}`;
    approve(enrollmentId, "self-attested", "Marked complete by worker");
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-foreground tracking-tight">
            Training &amp; Certifications
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {enrollments.length} course{enrollments.length !== 1 ? "s" : ""} assigned ·{" "}
            <span className="text-emerald-600 font-medium">{approvedCount} completed</span>
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 grid place-items-center shrink-0">
          <GraduationCap className="h-5 w-5 text-indigo-500" />
        </div>
      </div>

      <EligibilitySection eligibility={eligibility} />

      <div className="space-y-3">
        <FilterTabs active={activeFilter} onChange={setActiveFilter} counts={counts} />

        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border border-border bg-white flex flex-col items-center justify-center py-14 px-6 text-center"
            style={{ boxShadow: "0 1px 6px 0 rgba(0,0,0,0.05)" }}
          >
            <div className="h-14 w-14 rounded-2xl bg-gray-100 grid place-items-center mb-4">
              <GraduationCap className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-[14px] font-semibold text-foreground">
              {activeFilter === "all" ? "No coursework assigned" : `No ${activeFilter} courses`}
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[240px]">
              {activeFilter === "all"
                ? "Your administrator will assign training modules here."
                : "Try a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e: Enrollment) => (
              <CourseCard
                key={e.id}
                enrollment={e}
                onSubmit={() => handleComplete(e.courseId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}