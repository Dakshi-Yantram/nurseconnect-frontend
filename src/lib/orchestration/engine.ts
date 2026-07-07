/**
 * Phase 4 — Workflow Orchestration Engine.
 *
 * Centralized transition execution:
 *   - Validates against the workflow registry (canTransition).
 *   - Applies role-aware action guards (`can()`).
 *   - Runs declarative side-effects (cascade transitions, flag updates).
 *   - Emits DomainEvents → history store + event bus.
 *
 * Pages MUST NOT mutate entity status directly; they call
 * `OrchestrationStore.executeTransition()` (exposed via the
 * `useTransition()` hook).
 */
import { canTransition, type WorkflowKey, getStatusMeta, WORKFLOWS } from "@/lib/workflows";
import { can, type ActionKey } from "@/lib/actions";
import type { Role } from "@/lib/rbac";
import { bus, nextEventId, type DomainEvent } from "./events";
import { HistoryStore, eventToEntry } from "./history";
import { buildRepositories, type InMemoryRepository, type EntityRecord } from "./repositories";
import { bindStatus } from "@/lib/workflow-bind";
export interface TransitionInput {
  workflow: WorkflowKey;
  entityId: string;
  to: string;
  actor: string;
  role: Role | null;
  action?: ActionKey;        // optional action requirement
  notes?: string;
  patch?: Record<string, any>;  // additional entity-data merges
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  /** Stable machine-readable code for guard rejections. */
  code?: string;
  entity?: EntityRecord;
  event?: DomainEvent;
}

/**
 * Phase 6C — Pre-transition guards.
 *
 * A guard runs after registry validity but before mutation. It inspects the
 * current entity record + transition input, and returns a structured error
 * (code + message) to block the transition, or void to pass.
 *
 * Backend-truth alignment: these are the same preconditions the real backend
 * is expected to enforce (consent present, checklist complete, documentation
 * complete, worker assigned). UI cannot bypass them.
 */
export type GuardRejection = { code: string; message: string };
export type TransitionGuard = (
  entity: EntityRecord, input: TransitionInput,
) => GuardRejection | void;

const TRANSITION_GUARDS: Partial<Record<WorkflowKey, Partial<Record<string, TransitionGuard[]>>>> = {
  booking: {
    // Check-in requires consent on file.
    in_progress: [
      (rec) => {
        if (!rec.data?.consentAccepted) {
          return {
            code: "CONSENT_REQUIRED",
            message: "Patient consent required before check-in.",
          };
        }
      },
    ],
    // Check-out requires assignment + checklist + documentation complete.
    completed: [
      (rec, input) => {
        const claimedBy = rec.data?.claimedBy;
        if (claimedBy && input.actor && claimedBy !== input.actor
          && rec.data?.claimedByName !== input.actor) {
          return { code: "NOT_ASSIGNED", message: "Visit is not assigned to the current worker." };
        }
      },
      (rec) => {
        if (!rec.data?.checklistComplete) {
          return { code: "CHECKLIST_INCOMPLETE", message: "Complete the clinical checklist before checkout." };
        }
      },
      (rec) => {
        if (!rec.data?.documentationComplete) {
          return {
            code: "DOCUMENTATION_INCOMPLETE",
            message: "Complete all required visit documentation before checkout.",
          };
        }
      },
    ],
  },
};

function runGuards(entity: EntityRecord, input: TransitionInput): GuardRejection | null {
  const guards = TRANSITION_GUARDS[input.workflow]?.[input.to];
  if (!guards) return null;
  for (const g of guards) {
    const r = g(entity, input);
    if (r) return r;
  }
  return null;
}

/** Side-effects fired after a primary transition succeeds. */
type SideEffect = (input: TransitionInput, store: OrchestrationStore) => void;

const SIDE_EFFECTS: Partial<Record<WorkflowKey, Partial<Record<string, SideEffect>>>> = {
  complaint: {
    escalated: (i, s) => {
      // Cascade: escalating a complaint raises a paired incident flag.
      const c = s.repos.complaint.get(i.entityId);
      if (c) s.repos.complaint.upsert({ ...c, data: { ...c.data, escalation_flagged: true } });
    },
    resolved: (i, s) => {
      const c = s.repos.complaint.get(i.entityId);
      if (c) s.repos.complaint.upsert({ ...c, data: { ...c.data, sla: "Resolved" } });
    },
  },
  dispute: {
    resolved: (i, s) => {
      const d = s.repos.dispute.get(i.entityId);
      if (d) s.repos.dispute.upsert({ ...d, data: { ...d.data, hold: false } });
    },
  },
  incident: {
    escalated: (i, s) => {
      const inc = s.repos.incident.get(i.entityId);
      if (inc) s.repos.incident.upsert({ ...inc, data: { ...inc.data, assigned: "Clinical Director", severity: "high" } });
    },
  },
  payout: {
    failed: (i, s) => {
      const p = s.repos.payout.get(i.entityId);
      if (p) s.repos.payout.upsert({ ...p, data: { ...p.data, ops_flag: "review" } });
    },
  },
};

const LS_KEY = "nurseconnect_orchestration_v1";

export class OrchestrationStore {
  repos = buildRepositories();
  history = new HistoryStore();
  version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      (Object.keys(this.repos) as WorkflowKey[]).forEach((w) => {
        const records = saved.repos?.[w];
        if (Array.isArray(records)) {
          records.forEach((rec: EntityRecord) => {
            // Legacy/unknown states (e.g. "pending_payment") aren't in the
            // registry — normalize them to a valid state so canTransition()
            // and executeTransition() see consistent, real state, not just
            // a display-layer alias.
            if (!WORKFLOWS[w].states[rec.state]) {
              const bound = bindStatus(w, rec.state);
              rec = { ...rec, state: bound, data: { ...rec.data, status: bound } };
            }
            this.repos[w].upsert(rec);
          });
        }
      });
      if (Array.isArray(saved.history)) {
        this.history.seed(saved.history);
      }
    } catch (e) {
      console.error("Failed to hydrate orchestration store from localStorage", e);
    }
  }
  private persist() {
    if (typeof window === "undefined") return;
    try {
      const repos: Record<string, EntityRecord[]> = {};
      (Object.keys(this.repos) as WorkflowKey[]).forEach((w) => {
        repos[w] = this.repos[w].list();
      });
      const history = this.history.recent(1000);
      window.localStorage.setItem(LS_KEY, JSON.stringify({ repos, history }));
    } catch (e) {
      console.error("Failed to persist orchestration store to localStorage", e);
    }
  }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
  private notify() { this.version++; this.persist(); this.listeners.forEach(l => l()); }

  private repo(workflow: WorkflowKey): InMemoryRepository { return this.repos[workflow]; }

  executeTransition(input: TransitionInput): TransitionResult {
    const repo = this.repo(input.workflow);
    const entity = repo.get(input.entityId);
    if (!entity) return { ok: false, error: `Unknown ${input.workflow} ${input.entityId}` };

    // Guard 1: action permission (when bound).
    if (input.action && !can(input.role, input.action)) {
      const evt = this.emit("workflow.guard_rejected", input, entity.state);
      return { ok: false, error: "Action not permitted for role", event: evt };
    }
    // Guard 2: registry-defined transition validity.
    if (!canTransition(input.workflow, entity.state, input.to)) {
      const evt = this.emit("workflow.guard_rejected", input, entity.state);
      return { ok: false, error: `Illegal transition ${entity.state} → ${input.to}`, event: evt };
    }
    // Guard 3: target state must exist.
    if (!getStatusMeta(input.workflow, input.to)) {
      return { ok: false, error: `Unknown target state ${input.to}` };
    }
    // Guard 4: domain preconditions (Phase 6C).
    const rejection = runGuards(entity, input);
    if (rejection) {
      const evt = this.emit("workflow.guard_rejected", { ...input, notes: input.notes ?? rejection.message }, entity.state);
      return { ok: false, error: rejection.message, code: rejection.code, event: evt };
    }

    const from = entity.state;
    const updated: EntityRecord = {
      ...entity,
      state: input.to,
      enteredAt: new Date().toISOString(),
      data: { ...entity.data, ...(input.patch ?? {}), status: input.to },
    };
    repo.upsert(updated);

    const event = this.emit("workflow.transitioned", input, from);
    SIDE_EFFECTS[input.workflow]?.[input.to]?.(input, this);

    this.notify();
    return { ok: true, entity: updated, event };
  }

  /** Record a manual note (no state change) — keeps audit completeness. */
  annotate(workflow: WorkflowKey, entityId: string, actor: string, role: Role | null, notes: string) {
    const rec = this.repo(workflow).get(entityId);
    this.emit("entity.updated", { workflow, entityId, to: rec?.state ?? "", actor, role, notes }, rec?.state ?? "");
    this.notify();
  }

  /**
   * Phase 7E — Authoritative data patch (no state change).
   *
   * Centralizes readiness/data mutations (consent acknowledgement, checklist
   * completion stamps, documentation submission stamps) through the
   * orchestration store instead of letting screens reach into
   * `store.repos.<workflow>.upsert(...)` directly. This keeps the repository
   * boundary single-writer and makes the path persistence-ready — when a
   * real backend lands, swapping `repo.upsert` for an RPC stays a one-file
   * change rather than a screen-by-screen migration.
   */
  patchEntity(
    workflow: WorkflowKey,
    entityId: string,
    patch: Record<string, any>,
    actor: string,
    role: Role | null,
    notes: string,
  ): EntityRecord | null {
    const repo = this.repo(workflow);
    const rec = repo.get(entityId);
    if (!rec) return null;
    const updated: EntityRecord = { ...rec, data: { ...rec.data, ...patch } };
    repo.upsert(updated);
    this.emit("entity.updated", { workflow, entityId, to: rec.state, actor, role, notes }, rec.state);
    this.notify();
    return updated;
  }

  /**
   * Phase 6B+A — Marketplace claim primitive.
   *
   * Atomic in-process claim: if an entity is already claimed by a different
   * actor, returns a conflict result and emits `workflow.guard_rejected` so
   * the timeline records the contention. On success the entity transitions
   * via executeTransition() (so all guard/event/side-effect plumbing runs)
   * and is stamped with `claimedBy` / `claimedByName` / `claimedAt`.
   *
   * Frontend-only race simulation — backend race-condition handling lives
   * in a later phase.
   */
  claim(input: {
    workflow: WorkflowKey;
    entityId: string;
    claimantId: string;
    claimantName: string;
    role: Role | null;
    to?: string;             // target state, defaults to "claimed"
  }): TransitionResult {
    const repo = this.repo(input.workflow);
    const rec = repo.get(input.entityId);
    if (!rec) return { ok: false, error: `Unknown ${input.workflow} ${input.entityId}` };

    const existing = rec.data?.claimedBy as string | undefined;
    if (existing && existing !== input.claimantId) {
      const evt = this.emit("workflow.guard_rejected", {
        workflow: input.workflow, entityId: input.entityId,
        to: input.to ?? "claimed", actor: input.claimantName, role: input.role,
        action: "worker.claim_assignment",
        notes: `Claim conflict — already claimed by ${rec.data?.claimedByName ?? existing}`,
      }, rec.state);
      return {
        ok: false,
        error: "Customer already claimed by another professional",
        event: evt,
      };
    }

    return this.executeTransition({
      workflow: input.workflow,
      entityId: input.entityId,
      to: input.to ?? "claimed",
      actor: input.claimantName,
      role: input.role,
      action: "worker.claim_assignment",
      notes: existing ? "Re-claim by current owner" : `Claimed by ${input.claimantName}`,
      patch: {
        claimedBy: input.claimantId,
        claimedByName: input.claimantName,
        claimedAt: new Date().toISOString(),
      },
    });
  }

  /** Release an existing claim — returns the entity to the open pool. */
  release(input: {
    workflow: WorkflowKey; entityId: string; actor: string; role: Role | null;
  }): TransitionResult {
    const repo = this.repo(input.workflow);
    const rec = repo.get(input.entityId);
    if (!rec) return { ok: false, error: `Unknown ${input.workflow} ${input.entityId}` };
    return this.executeTransition({
      workflow: input.workflow, entityId: input.entityId,
      to: "pending", actor: input.actor, role: input.role,
      action: "worker.release_assignment",
      notes: "Claim released",
      patch: { claimedBy: null, claimedByName: null, claimedAt: null },
    });
  }

  /**
   * Create a new entity, seeded at the workflow's initial state, and emit
   * `entity.created` so the timeline picks it up automatically.
   * Used by consumer flows (booking, consent capture) and any portal that
   * needs to spawn workflow-tracked records at runtime.
   */
  createEntity(
    workflow: WorkflowKey,
    data: Record<string, any>,
    actor: string,
    role: Role | null,
    opts?: { id?: string; state?: string; notes?: string },
  ): EntityRecord {
    const repo = this.repo(workflow);
    const id = opts?.id ?? `${workflow.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const initial = opts?.state ?? WORKFLOWS[workflow].initial;
    const rec: EntityRecord = {
      id, workflow, state: initial,
      enteredAt: new Date().toISOString(),
      data: { ...data, status: initial },
    };
    repo.upsert(rec);
    const evt: DomainEvent = {
      id: nextEventId(), kind: "entity.created",
      workflow, entityId: id, actor, role,
      ts: rec.enteredAt, to: initial, notes: opts?.notes ?? `Created ${workflow}`,
    };
    this.history.record(eventToEntry(evt));
    bus.emit(evt);
    this.notify();
    return rec;
  }



  private emit(kind: DomainEvent["kind"], input: TransitionInput, from: string): DomainEvent {
    const evt: DomainEvent = {
      id: nextEventId(),
      kind, workflow: input.workflow, entityId: input.entityId,
      actor: input.actor, role: input.role,
      ts: new Date().toISOString(),
      from, to: input.to || undefined, action: input.action, notes: input.notes,
    };
    this.history.record(eventToEntry(evt));
    bus.emit(evt);
    return evt;
  }
}
