/**
 * Phase 4 — Orchestration React surface.
 *
 * Provides:
 *   - <OrchestrationProvider> (mounted by DomainProvider)
 *   - useOrchestration() — raw store access
 *   - useTransition()    — execute a transition with toast feedback
 *   - useEntityHistory(workflow, id) — timeline entries for an entity
 *   - useEntity(workflow, id)        — live entity record
 *   - useVersionStore()  — singleton version store for authored docs
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import { toast } from "sonner";
import { OrchestrationStore, type TransitionInput, type TransitionResult } from "./engine";
import { VersionStore } from "./versioning";
import { eventToEntry, type TimelineEntry } from "./history";
import type { WorkflowKey } from "@/lib/workflows";
import type { Role } from "@/lib/rbac";
import type { DomainEvent } from "./events";
import { QUEUE_SELECTORS, type QueueItem, type QueueName } from "./queues";
import { deriveExecutionStage } from "@/lib/execution-stage";
import { bookingPatientName, bookingPatientId } from "./links";

interface Ctx {
  store: OrchestrationStore;
  versions: VersionStore<any>;
}

const OrchestrationCtx = createContext<Ctx | null>(null);

export function OrchestrationProvider({ children }: { children: ReactNode }) {
  const ctx = useMemo<Ctx>(() => {
    const store = new OrchestrationStore();
    const versions = new VersionStore();
    // Seed an opening event per entity so timelines aren't empty on first view.
    const initial: TimelineEntry[] = [];
    (Object.keys(store.repos) as WorkflowKey[]).forEach(w => {
      store.repos[w].list().forEach(rec => {
        initial.push(eventToEntry({
          id: `seed_${w}_${rec.id}`, kind: "entity.created",
          workflow: w, entityId: rec.id,
          actor: "system", role: null, ts: rec.enteredAt,
          to: rec.state, notes: "Imported from operational seed",
        } as DomainEvent));
      });
    });
    store.history.seed(initial);
    return { store, versions };
  }, []);
  return <OrchestrationCtx.Provider value={ctx}>{children}</OrchestrationCtx.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(OrchestrationCtx);
  if (!c) throw new Error("useOrchestration must be used within <OrchestrationProvider>");
  return c;
}

export function useOrchestration() { return useCtx().store; }
export function useVersionStore() { return useCtx().versions; }

/** Shallow array/object equality — prevents render loops when selectors
 *  return freshly-allocated arrays with identical contents. */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object); const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!Object.is((a as any)[k], (b as any)[k])) return false;
    return true;
  }
  return false;
}

/** Re-renders whenever the orchestration store mutates. Uses shallow equality
 *  so selectors that allocate fresh arrays don't trigger useSyncExternalStore
 *  infinite loops (React error #185). */
function useStoreSnapshot<T>(selector: (s: OrchestrationStore) => T): T {
  const store = useOrchestration();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSnapshot = useCallback(() => store, [store]);
  return useSyncExternalStoreWithSelector(
    store.subscribe, getSnapshot, getSnapshot,
    (s) => selectorRef.current(s),
    shallowEqual,
  );
}

export function useEntity(workflow: WorkflowKey, id: string | null | undefined) {
  return useStoreSnapshot(s => (id ? s.repos[workflow].get(id) : undefined));
}

export function useEntities(workflow: WorkflowKey) {
  return useStoreSnapshot(s => s.repos[workflow].list());
}

/** Phase 6B+A — ownership-aware queries. Reactive via store snapshots. */
export function useEntitiesByOwner(workflow: WorkflowKey, ownerId: string | null | undefined) {
  return useStoreSnapshot(s => (ownerId ? s.repos[workflow].listByOwner(ownerId) : []));
}
export function useUnclaimedEntities(workflow: WorkflowKey) {
  return useStoreSnapshot(s => s.repos[workflow].listUnclaimed());
}
export function useEntitiesClaimedBy(workflow: WorkflowKey, claimantId: string | null | undefined) {
  return useStoreSnapshot(s => (claimantId ? s.repos[workflow].listClaimedBy(claimantId) : []));
}

export function useEntityHistory(workflow: WorkflowKey, id: string | null | undefined): TimelineEntry[] {
  return useStoreSnapshot(s => (id ? s.history.for(workflow, id) : []));
}

/** Phase 6B+B — Queue-driven operational visibility. Reactive over the store. */
export function useQueue(name: QueueName): QueueItem[] {
  return useStoreSnapshot(s => QUEUE_SELECTORS[name](s));
}
export type { QueueItem, QueueName } from "./queues";

export function useTransition() {
  const store = useOrchestration();
  return useCallback((input: TransitionInput, opts?: { successMessage?: string }): TransitionResult => {
    const res = store.executeTransition(input);
    if (res.ok) toast.success(opts?.successMessage ?? `Updated to ${input.to}`);
    else toast.error(res.error ?? "Transition rejected");
    return res;
  }, [store]);
}

/**
 * Phase 6B+A — Claim a marketplace assignment. Routes through the engine's
 * conflict-aware claim() primitive and surfaces the canonical
 * "Customer already claimed by another professional" toast on conflicts.
 */
export function useClaim() {
  const store = useOrchestration();
  return useCallback((input: {
    workflow: WorkflowKey; entityId: string;
    claimantId: string; claimantName: string;
    role: Role | null; to?: string;
  }, opts?: { successMessage?: string }): TransitionResult => {
    const res = store.claim(input);
    if (res.ok) toast.success(opts?.successMessage ?? `Claimed #${input.entityId}`);
    else toast.error(res.error ?? "Claim rejected");
    return res;
  }, [store]);
}

export function useRelease() {
  const store = useOrchestration();
  return useCallback((input: {
    workflow: WorkflowKey; entityId: string; actor: string; role: Role | null;
  }, opts?: { successMessage?: string }): TransitionResult => {
    const res = store.release(input);
    if (res.ok) toast.success(opts?.successMessage ?? `Released #${input.entityId}`);
    else toast.error(res.error ?? "Release rejected");
    return res;
  }, [store]);
}

/**
 * Version-aware editor hook (Phase 5).
 * Returns the published baseline, the current draft, plus saveDraft/publish
 * actions wired to the orchestration VersionStore.
 */
export function useVersionedDoc<T>(key: string, initialPublished?: T) {
  const versions = useVersionStore() as VersionStore<T>;
  // Effect-driven seed — never mutate during render (avoids hydration warnings
  // and subscriber notifications inside React's render phase).
  useEffect(() => {
    if (initialPublished !== undefined && !versions.latest(key)) {
      versions.seedPublished(key, initialPublished);
    }
  }, [versions, key, initialPublished]);
  const snapshot = useSyncExternalStoreWithSelector(
    versions.subscribe,
    () => versions,
    () => versions,
    (v: VersionStore<T>) => v.list(key),
    shallowEqual,
  );
  const published = versions.published(key);
  const draft = versions.draft(key);
  return {
    versions: snapshot,
    published,
    draft,
    current: draft ?? published,
    saveDraft: (body: T, actor: string) => versions.saveDraft(key, body, actor),
    publish: (actor: string) => versions.publish(key, actor),
  };
}

/**
 * Phase 7E — Centralized worker execution snapshot.
 *
 * Single read-side hook that gives the worker portal a coordinated view of
 * its operational state: claimed assignments split into active/pending,
 * unclaimed marketplace opportunities, and an assignment-queue-derived
 * priority lookup. Routes no longer reach for three different orchestration
 * hooks and recompute the same filters inline — execution rendering becomes
 * predictable and persistence-ready (single hook to swap when a backend
 * service lands).
 */
export function useWorkerExecutionSnapshot(claimantId: string | null | undefined) {
  const mine = useEntitiesClaimedBy("booking", claimantId);
  const openAll = useUnclaimedEntities("booking");
  const assignmentQueue = useQueue("assignment");

  return useMemo(() => {
    const active = mine.filter(r => r.state === "active" || r.state === "in_progress");
    const pending = mine.filter(r => r.state === "claimed");
    const open = openAll.filter(r => r.state === "pending");
    const priorityIndex = new Map(assignmentQueue.map(q => [q.id, q.priority] as const));
    const priorityFor = (id: string) => priorityIndex.get(id);
    return { mine, active, pending, open, assignmentQueue, priorityFor };
  }, [mine, openAll, assignmentQueue]);
}

/**
 * Phase 8E — Visit lifecycle continuity snapshot.
 *
 * Coordinates the execution-lifecycle view for a single booking so the
 * worker visit surface stops re-deriving the same shape inline. Combines:
 *   - the entity record and its derived execution stage
 *   - the readiness ledger (consent / checklist / documentation + timestamps)
 *   - escalation continuity (current + prior escalations from history)
 *   - the prior workflow transition (so progression feels longitudinal)
 *   - a completion-readiness rollup (met / total / remaining gating items)
 *
 * Pure derivation over the repository + history store — no new state, no
 * engine changes. Memoized so consumers stay hydration-safe.
 */
export function useVisitLifecycle(visitId: string | null | undefined) {
  const rec = useStoreSnapshot(s => (visitId ? s.repos.booking.get(visitId) ?? null : null));
  const history = useStoreSnapshot(s => (visitId ? s.history.for("booking", visitId) : []));

  return useMemo(() => {
    if (!rec) {
      return {
        rec: null as null,
        stage: null as null,
        readiness: [] as { key: string; label: string; ok: boolean; at?: string }[],
        completion: { met: 0, total: 0, remaining: [] as string[], ready: false },
        escalation: { active: false, priorCount: 0, lastAt: undefined as string | undefined, resumed: false },
        transitions: [] as TimelineEntry[],
        priorStage: undefined as string | undefined,
        history,
      };
    }
    const d: any = rec.data ?? {};
    const stage = deriveExecutionStage(rec);

    const readiness = [
      { key: "consent", label: "Patient consent", ok: !!d.consentAccepted, at: d.consentAt },
      { key: "checklist", label: "Clinical checklist", ok: !!d.checklistComplete, at: d.checklistAt },
      { key: "documentation", label: "Visit documentation", ok: !!d.documentationComplete, at: d.documentationAt },
    ];
    const met = readiness.filter(r => r.ok).length;
    const remaining = readiness.filter(r => !r.ok).map(r => r.label);
    const completion = { met, total: readiness.length, remaining, ready: met === readiness.length };

    const transitions = history.filter(h => h.kind === "workflow.transitioned");
    const escalations = transitions.filter(h => h.to === "escalated");
    const escalation = {
      active: rec.state === "escalated",
      priorCount: escalations.length,
      lastAt: escalations[0]?.ts,
      resumed: rec.state !== "escalated" && escalations.length > 0,
    };
    const priorStage = transitions[0]?.from;

    return { rec, stage, readiness, completion, escalation, transitions, priorStage, history };
  }, [rec, history]);
}


/**
 * Phase 8A — Centralized moderation snapshot.
 *
 * Coordinates the three queue selectors the reviewer/trainer surfaces depend
 * on (moderation, onboarding, sla_breached) into a single memoized snapshot
 * so routes stop re-deriving the same operational counts inline. Keeps
 * rendering predictable and persistence-ready — swapping any queue selector
 * for a backed RPC stays a single-hook change.
 */
export function useModerationSnapshot() {
  const moderation = useQueue("moderation");
  const onboarding = useQueue("onboarding");
  const slaBreached = useQueue("sla_breached");
  // Phase 8F — lifecycle continuity: recent reviewer decisions over the last
  // 24h, derived from the unified history log. Drives the lifecycle strip on
  // the moderation surface so the queue feels longitudinal rather than a
  // snapshot rollup. Pure read — no new state.
  const recent = useStoreSnapshot(s => s.history.recent(200));
  return useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    let approvedRecent = 0, rejectedRecent = 0, escalatedRecent = 0;
    let lastDecisionAt: string | undefined;
    for (const e of recent) {
      if (e.kind !== "workflow.transitioned") continue;
      const ts = Date.parse(e.ts);
      if (!Number.isNaN(ts) && ts >= since) {
        if (e.to === "completed" || e.to === "resolved" || e.to === "in_progress") {
          approvedRecent++;
        } else if (e.to === "cancelled" || e.to === "rejected") {
          rejectedRecent++;
        } else if (e.to === "escalated") {
          escalatedRecent++;
        }
      }
      if ((e.to === "completed" || e.to === "resolved" || e.to === "cancelled" || e.to === "rejected") &&
        (!lastDecisionAt || e.ts > lastDecisionAt)) lastDecisionAt = e.ts;
    }
    return {
      moderation,
      onboarding,
      slaBreached,
      counts: {
        moderation: moderation.length,
        onboarding: onboarding.length,
        slaBreached: slaBreached.length,
      },
      lifecycle: {
        approvedRecent, rejectedRecent, escalatedRecent,
        decidedRecent: approvedRecent + rejectedRecent,
        lastDecisionAt,
      },
    };
  }, [moderation, onboarding, slaBreached, recent]);
}

/**
 * Phase 8B — Centralized consumer care-continuity snapshot.
 *
 * Coordinates the consumer portal's longitudinal view over the booking
 * repository so consumer surfaces stop re-deriving the same care buckets
 * inline. Returns journey-oriented groupings (upcoming / in care now /
 * recently completed / escalated) plus a per-patient grouping suitable
 * for rendering continuity timelines. Hydration-safe: groupings are
 * derived from repository state (no Date.now() in the selector), so the
 * SSR and client snapshots match.
 *
 * Optionally scoped to an ownerId — when present, only bookings owned by
 * that consumer flow into the snapshot. Falls back to the full booking
 * set so reused care widgets continue to work on dev/seed data.
 */
export function useConsumerCareSnapshot(ownerId?: string | null) {
  const all = useEntities("booking");
  return useMemo(() => {
    const scoped = ownerId
      ? all.filter(r => (r.data as any)?.ownerId === ownerId)
      : all;
    const upcoming = scoped.filter(r =>
      r.state === "pending" ||
      r.state === "claimed" ||
      r.state === "pending_payment"
    );
    const inCare = scoped.filter(r => r.state === "active" || r.state === "in_progress");
    const completed = scoped.filter(r => r.state === "completed");
    const escalated = scoped.filter(r => r.state === "escalated");

    // Phase 9B — group via the centralized link helpers so name- and
    // id-based continuity reads stay consistent with the rest of the
    // runtime (no per-selector re-derivation of patient identity).
    const byPatient = new Map<string, typeof scoped>();
    const byPatientId = new Map<string, typeof scoped>();
    for (const r of scoped) {
      const name = bookingPatientName(r) ?? "Unassigned";
      const arr = byPatient.get(name) ?? [];
      arr.push(r);
      byPatient.set(name, arr);
      const pid = bookingPatientId(r);
      if (pid) {
        const idArr = byPatientId.get(pid) ?? [];
        idArr.push(r);
        byPatientId.set(pid, idArr);
      }
    }

    return {
      all: scoped,
      upcoming,
      inCare,
      completed,
      escalated,
      byPatient,
      byPatientId,
      counts: {
        upcoming: upcoming.length,
        inCare: inCare.length,
        completed: completed.length,
        escalated: escalated.length,
      },
    };
  }, [all, ownerId]);
}

/**
 * Phase 9A — Admin operational command-center snapshot.
 *
 * Coordinates the queue selectors the admin ops surface depends on
 * (assignment / escalation / moderation / dispute / sla_breached) into a
 * single memoized snapshot plus a longitudinal 24h operational lifecycle
 * rollup (dispatch progression, escalation recovery, intervention recency)
 * derived from the shared history log. Pure derivation — no new state,
 * no engine changes.
 */
export interface AdminInterventionEntry {
  id: string;
  ts: string;
  workflow: WorkflowKey;
  entityId: string;
  from?: string;
  to?: string;
  actor: string;
  notes?: string;
  tone: "primary" | "success" | "warning" | "danger" | "muted" | "info";
}

export function useAdminOperationsSnapshot() {
  const assignment = useQueue("assignment");
  const escalation = useQueue("escalation");
  const moderation = useQueue("moderation");
  const dispute = useQueue("dispute");
  const slaBreached = useQueue("sla_breached");
  const recent = useStoreSnapshot(s => s.history.recent(200));

  return useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;

    const allActionable = [
      ...assignment, ...escalation, ...moderation, ...dispute, ...slaBreached,
    ];
    const urgentItems = allActionable.filter(it => it.priority === "urgent");
    const breachedItems = allActionable.filter(it => it.breached);

    const dispatchUnclaimed = assignment.filter(it => it.state === "pending").length;
    const dispatchClaimed = assignment.filter(it => it.state === "claimed").length;

    const activeEscalations = escalation.length;
    let escalationsOpened24h = 0;
    let escalationsRecovered24h = 0;
    let lastInterventionAt: string | undefined;
    let dispatchesDecided24h = 0;
    let interventionsDecided24h = 0;

    const recentInterventions: AdminInterventionEntry[] = [];
    for (const e of recent) {
      if (e.kind !== "workflow.transitioned") continue;
      const ts = Date.parse(e.ts);
      const within24h = !Number.isNaN(ts) && ts >= since;
      if (within24h) {
        if (e.to === "escalated") escalationsOpened24h++;
        if (e.from === "escalated" && e.to && e.to !== "escalated") escalationsRecovered24h++;
        if (e.workflow === "booking" && (e.to === "claimed" || e.to === "active" || e.to === "in_progress")) {
          dispatchesDecided24h++;
        }
        if (e.to === "resolved" || e.to === "completed" || e.to === "cancelled" || e.to === "rejected" || e.to === "escalated") {
          interventionsDecided24h++;
        }
        if (recentInterventions.length < 12) {
          recentInterventions.push({
            id: e.id, ts: e.ts, workflow: e.workflow, entityId: e.entityId,
            from: e.from, to: e.to, actor: e.actor, notes: e.notes,
            tone: e.to === "escalated" ? "warning"
              : e.to === "cancelled" || e.to === "rejected" ? "danger"
                : e.to === "resolved" || e.to === "completed" ? "success"
                  : "primary",
          });
        }
      }
      if (!lastInterventionAt || e.ts > lastInterventionAt) lastInterventionAt = e.ts;
    }

    const priorityFeed = [...allActionable]
      .sort((a, b) => {
        const pa = a.priority === "urgent" ? 0 : a.priority === "high" ? 1 : 2;
        const pb = b.priority === "urgent" ? 0 : b.priority === "high" ? 1 : 2;
        if (pa !== pb) return pa - pb;
        const sa = a.slaMinutes ?? Number.POSITIVE_INFINITY;
        const sb = b.slaMinutes ?? Number.POSITIVE_INFINITY;
        return sa - sb;
      })
      .slice(0, 8);

    return {
      queues: { assignment, escalation, moderation, dispute, slaBreached },
      counts: {
        assignment: assignment.length,
        escalation: escalation.length,
        moderation: moderation.length,
        dispute: dispute.length,
        slaBreached: slaBreached.length,
        urgent: urgentItems.length,
        breached: breachedItems.length,
        actionable: allActionable.length,
      },
      dispatch: {
        unclaimed: dispatchUnclaimed,
        claimed: dispatchClaimed,
        decidedRecent: dispatchesDecided24h,
      },
      escalationLifecycle: {
        active: activeEscalations,
        opened24h: escalationsOpened24h,
        recovered24h: escalationsRecovered24h,
      },
      interventionLifecycle: {
        decidedRecent: interventionsDecided24h,
        lastAt: lastInterventionAt,
        feed: recentInterventions,
      },
      priorityFeed,
    };
  }, [assignment, escalation, moderation, dispute, slaBreached, recent]);
}




