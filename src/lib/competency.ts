/**
 * Phase 7A — Lightweight competency runtime.
 *
 * In-memory coursework + reviewer-approval store. Drives:
 *   - worker training visibility (assigned coursework / pending assessments)
 *   - eligibility-aware assignment claim gating
 *   - reviewer competency orchestration queue
 *
 * Architecture-safe: this is a small standalone store. It does NOT replace
 * orchestration repositories, queues, or workflows. Engine guards remain the
 * authoritative checkpoint for execution transitions; competency only gates
 * UI-level eligibility (claim affordance) and reviewer queues.
 */
import { useEffect, useSyncExternalStore } from "react";

export type CompetencyStatus = "pending" | "submitted" | "approved" | "rejected";

export interface Course {
  id: string;
  title: string;
  duration: string;
  /** Required for operational eligibility. */
  required: boolean;
  summary: string;
}

export interface PriorDecision {
  status: "approved" | "rejected";
  at: string;
  reviewer?: string;
  notes?: string;
}

export interface Enrollment {
  id: string;          // workerId:courseId
  workerId: string;
  workerName: string;
  courseId: string;
  status: CompetencyStatus;
  updatedAt: string;
  reviewer?: string;
  notes?: string;
  /** Phase 8F — submission count drives resubmission continuity. */
  submissionCount?: number;
  /** Phase 8F — prior approve/reject decisions for longitudinal review continuity. */
  priorDecisions?: PriorDecision[];
}

export const COURSE_CATALOG: Course[] = [
  { id: "CRS-INF",  title: "Infection control essentials",   duration: "45m", required: true,
    summary: "Hand hygiene, PPE protocols, sharps handling." },
  { id: "CRS-ESC",  title: "Clinical escalation protocols",  duration: "30m", required: true,
    summary: "When and how to escalate; SBAR handoff." },
  { id: "CRS-GER",  title: "Geriatric mobility & falls",     duration: "60m", required: true,
    summary: "Safe transfers, fall risk, family communication." },
  { id: "CRS-WND",  title: "Wound care — advanced",          duration: "90m", required: false,
    summary: "Dressing selection, exudate management, photography." },
  { id: "CRS-DIA",  title: "Diabetes monitoring",            duration: "40m", required: false,
    summary: "Glucometry, sliding scale, hypo protocols." },
];

const SEED_ANCHOR = "2026-07-01T09:00:00.000Z";

function seedEnrollments(): Enrollment[] {
  const now = SEED_ANCHOR;
  const seed = (workerId: string, name: string): Enrollment[] => [

    { id: `${workerId}:CRS-INF`, workerId, workerName: name, courseId: "CRS-INF",
      status: "approved",  updatedAt: now, reviewer: "trainer@nurseconnect.in" },
    { id: `${workerId}:CRS-ESC`, workerId, workerName: name, courseId: "CRS-ESC",
      status: "submitted", updatedAt: now, notes: "Submitted by worker" },
    { id: `${workerId}:CRS-GER`, workerId, workerName: name, courseId: "CRS-GER",
      status: "pending",   updatedAt: now },
    { id: `${workerId}:CRS-WND`, workerId, workerName: name, courseId: "CRS-WND",
      status: "approved",  updatedAt: now, reviewer: "trainer@nurseconnect.in" },
  ];
  return [
    ...seed("worker-anon",   "Demo Worker"),
    ...seed("worker-priya",  "Priya Sharma"),
    ...seed("worker-rahul",  "Rahul Verma"),
  ];
}

// --- Store ------------------------------------------------------------------
class CompetencyStore {
  private enrollments: Enrollment[] = seedEnrollments();
  private listeners = new Set<() => void>();
  /** Monotonic version — bumped on every mutation. Drives selector memoization
   *  so React's useSyncExternalStore snapshot remains referentially stable. */
  version = 0;
  private workerCache = new Map<string, { version: number; items: Enrollment[] }>();
  private reviewCache: { version: number; items: Enrollment[] } | null = null;
  private lifecycleCache: { version: number; value: ReviewerCompetencyLifecycle } | null = null;

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
   private notify() {
    this.version++;
    this.workerCache.clear();
    this.reviewCache = null;
    this.lifecycleCache = null;
    this.listeners.forEach(l => l());
  }


  list(): Enrollment[] { return this.enrollments; }

  /** PURE read — never mutates. Auto-seeding is performed out-of-band via
   *  `ensureSeeded()` in a useEffect, so this is safe for use inside
   *  useSyncExternalStore selectors during render/hydration. */
  forWorker(workerId: string): Enrollment[] {
    if (!workerId) return [];
    const cached = this.workerCache.get(workerId);
    if (cached && cached.version === this.version) return cached.items;
    const existing = this.enrollments.filter(e => e.workerId === workerId);
    this.workerCache.set(workerId, { version: this.version, items: existing });
    return existing;
  }

  /** Effect-safe seeding for newly-observed workers. Called from a hook
   *  effect — never from render — so subscribers are notified normally. */
  ensureSeeded(workerId: string, workerName?: string) {
    if (!workerId) return;
    if (this.enrollments.some(e => e.workerId === workerId)) return;
    const now = new Date().toISOString();
    const created = COURSE_CATALOG.map<Enrollment>(c => ({
      id: `${workerId}:${c.id}`, workerId, workerName: workerName ?? workerId,
      courseId: c.id, status: "pending", updatedAt: now,
    }));
    this.enrollments = [...this.enrollments, ...created];
    this.notify();
  }

  reviewQueue(): Enrollment[] {
    if (this.reviewCache && this.reviewCache.version === this.version) return this.reviewCache.items;
    const items = this.enrollments
      .filter(e => e.status === "submitted")
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    this.reviewCache = { version: this.version, items };
    return items;
  }

  reviewerCompetencyLifecycle(): ReviewerCompetencyLifecycle {
    if (this.lifecycleCache && this.lifecycleCache.version === this.version) return this.lifecycleCache.value;

    const all = this.enrollments;
    const since = Date.now() - 24 * 60 * 60 * 1000;

    let awaiting = 0;
    let resubmissions = 0;
    let approvedRecent = 0;
    let rejectedRecent = 0;

    let lastDecisionAt: string | undefined;

    for (const e of all) {
      if (e.status === "submitted") {
        awaiting++;
        if ((e.submissionCount ?? 0) > 1 || (e.priorDecisions?.length ?? 0) > 0) {
          resubmissions++;
        }
      }

      if (e.status === "approved" || e.status === "rejected") {
        if (!lastDecisionAt || e.updatedAt > lastDecisionAt) lastDecisionAt = e.updatedAt;
        const ts = Date.parse(e.updatedAt);
        if (!Number.isNaN(ts) && ts >= since) {
          if (e.status === "approved") approvedRecent++;
          else rejectedRecent++;
        }
      }
    }

    const value: ReviewerCompetencyLifecycle = {
      awaiting,
      resubmissions,
      approvedRecent,
      rejectedRecent,
      decidedRecent: approvedRecent + rejectedRecent,
      lastDecisionAt,
    };

    this.lifecycleCache = { version: this.version, value };
    return value;
  }


  submit(workerId: string, workerName: string, courseId: string) {
    const id = `${workerId}:${courseId}`;
    const existing = this.enrollments.find(e => e.id === id);
    // Phase 8F — capture any prior approve/reject decision as continuity so
    // reviewers see resubmission history rather than a flat "submitted" chip.
    const prior: PriorDecision[] = existing?.priorDecisions ?? [];
    if (existing && (existing.status === "approved" || existing.status === "rejected")) {
      prior.unshift({
        status: existing.status, at: existing.updatedAt,
        reviewer: existing.reviewer, notes: existing.notes,
      });
    }
    const submissionCount = (existing?.submissionCount ?? 0) + 1;
    this.upsert(workerId, workerName, courseId, "submitted",
      undefined, "Worker submitted assessment",
      { submissionCount, priorDecisions: prior });
  }
  approve(enrollmentId: string, reviewer: string, notes?: string) {
    this.patch(enrollmentId, { status: "approved", reviewer, notes: notes ?? "Approved" });
  }
  reject(enrollmentId: string, reviewer: string, notes?: string) {
    this.patch(enrollmentId, { status: "rejected", reviewer, notes: notes ?? "Rejected — please resubmit" });
  }

  private upsert(
    workerId: string, workerName: string, courseId: string,
    status: CompetencyStatus, reviewer?: string, notes?: string,
    extra?: Partial<Enrollment>,
  ) {
    const id = `${workerId}:${courseId}`;
    const idx = this.enrollments.findIndex(e => e.id === id);
    const next: Enrollment = {
      id, workerId, workerName, courseId, status,
      updatedAt: new Date().toISOString(), reviewer, notes, ...extra,
    };
    if (idx === -1) this.enrollments = [...this.enrollments, next];
    else this.enrollments = this.enrollments.map((e, i) => i === idx ? { ...e, ...next } : e);
    this.notify();
  }

  private patch(id: string, patch: Partial<Enrollment>) {
    this.enrollments = this.enrollments.map(e => e.id === id
      ? { ...e, ...patch, updatedAt: new Date().toISOString() }
      : e);
    this.notify();
  }
}

export const competencyStore = new CompetencyStore();

// --- Derived selectors ------------------------------------------------------
export interface WorkerEligibility {
  eligible: boolean;
  total: number;
  approved: number;
  blockers: { courseId: string; title: string; status: CompetencyStatus }[];
}

export function deriveEligibility(enrollments: Enrollment[]): WorkerEligibility {
  const required = COURSE_CATALOG.filter(c => c.required);
  const blockers = required
    .map(c => {
      const e = enrollments.find(en => en.courseId === c.id);
      return { courseId: c.id, title: c.title, status: (e?.status ?? "pending") as CompetencyStatus };
    })
    .filter(b => b.status !== "approved");
  const approved = required.length - blockers.length;
  return { eligible: blockers.length === 0, total: required.length, approved, blockers };
}

export function getCourse(id: string): Course | undefined {
  return COURSE_CATALOG.find(c => c.id === id);
}

// --- React hooks ------------------------------------------------------------
function useStore<T>(selector: (s: CompetencyStore) => T): T {
  return useSyncExternalStore(
    competencyStore.subscribe,
    () => selector(competencyStore),
    () => selector(competencyStore),
  );
}

export function useWorkerEnrollments(
  workerId: string | null | undefined,
  workerName?: string | null,
): Enrollment[] {
  // Effect-driven seed — keeps the selector below pure for render/hydration.
  useEffect(() => {
    if (workerId) competencyStore.ensureSeeded(workerId, workerName ?? undefined);
  }, [workerId, workerName]);
  return useStore(s => (workerId ? s.forWorker(workerId) : []));
}

export function useWorkerEligibility(
  workerId: string | null | undefined,
  workerName?: string | null,
): WorkerEligibility {
  const enrollments = useWorkerEnrollments(workerId, workerName);
  return deriveEligibility(enrollments);
}

export function useCompetencyReviewQueue(): Enrollment[] {
  return useStore(s => s.reviewQueue());
}

export function useCompetencyActions() {
  return {
    submit: (workerId: string, workerName: string, courseId: string) =>
      competencyStore.submit(workerId, workerName, courseId),
    approve: (enrollmentId: string, reviewer: string, notes?: string) =>
      competencyStore.approve(enrollmentId, reviewer, notes),
    reject: (enrollmentId: string, reviewer: string, notes?: string) =>
      competencyStore.reject(enrollmentId, reviewer, notes),
  };
}

// --- Phase 8F — longitudinal continuity selectors -------------------------

export interface CompetencyProgression {
  total: number;
  approved: number;
  submitted: number;
  rejected: number;
  pending: number;
  requiredApproved: number;
  requiredTotal: number;
  lastActivityAt?: string;
  lastDecisionAt?: string;
  resubmissionCount: number;
}

export function deriveProgression(enrollments: Enrollment[]): CompetencyProgression {
  const required = new Set(COURSE_CATALOG.filter(c => c.required).map(c => c.id));
  let approved = 0, submitted = 0, rejected = 0, pending = 0, requiredApproved = 0;
  let lastActivityAt: string | undefined;
  let lastDecisionAt: string | undefined;
  let resubmissionCount = 0;
  for (const e of enrollments) {
    if (e.status === "approved")  { approved++;  if (required.has(e.courseId)) requiredApproved++; }
    if (e.status === "submitted") submitted++;
    if (e.status === "rejected")  rejected++;
    if (e.status === "pending")   pending++;
    if (!lastActivityAt || e.updatedAt > lastActivityAt) lastActivityAt = e.updatedAt;
    if ((e.status === "approved" || e.status === "rejected") &&
        (!lastDecisionAt || e.updatedAt > lastDecisionAt)) lastDecisionAt = e.updatedAt;
    if ((e.submissionCount ?? 0) > 1) resubmissionCount++;
  }
  return {
    total: enrollments.length,
    approved, submitted, rejected, pending,
    requiredApproved, requiredTotal: required.size,
    lastActivityAt, lastDecisionAt, resubmissionCount,
  };
}

export function useCompetencyProgression(
  workerId: string | null | undefined,
  workerName?: string | null,
): CompetencyProgression {
  const enrollments = useWorkerEnrollments(workerId, workerName);
  return deriveProgression(enrollments);
}

/**
 * Phase 8F — Reviewer/trainer lifecycle rollup.
 *
 * Longitudinal view of competency moderation across the whole roster:
 *   - awaiting:        currently-submitted assessments in queue
 *   - resubmissions:   submissions with prior rejected/approved decisions
 *   - decidedRecent:   approve/reject events in the last 24h
 *   - lastDecisionAt:  most recent reviewer decision timestamp
 *
 * Pure derivation over the enrollment store — no new state.
 */
export interface ReviewerCompetencyLifecycle {
  awaiting: number;
  resubmissions: number;
  approvedRecent: number;
  rejectedRecent: number;
  decidedRecent: number;
  lastDecisionAt?: string;
}

export function useReviewerCompetencyLifecycle(): ReviewerCompetencyLifecycle {
  return useStore(s => s.reviewerCompetencyLifecycle());
}

