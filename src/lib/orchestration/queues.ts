/**
 * Phase 6B+B — Operational queue runtime.
 *
 * Queue-driven view layer over existing repositories. Pure selectors — no new
 * state, no new mutations. Queues respect:
 *   - ownership-aware accessors (listByOwner/Unclaimed/ClaimedBy)
 *   - workflow registry (state, sla)
 *   - portal isolation (caller picks the queue appropriate to its portal)
 *
 * Used by the admin ops dashboard and moderation surfaces to behave like an
 * Uber/Practo-style operational orchestrator instead of a CRUD ERP.
 */
import type { OrchestrationStore } from "./engine";
import type { EntityRecord } from "./repositories";
import { slaRemainingMinutes, type WorkflowKey } from "@/lib/workflows";

export type QueuePriority = "urgent" | "high" | "normal" | "low";

export interface QueueItem {
  id: string;
  workflow: WorkflowKey;
  state: string;
  priority: QueuePriority;
  slaMinutes: number | null;     // remaining; negative = breached
  breached: boolean;
  enteredAt: string;
  record: EntityRecord;
}

export type QueueName =
  | "assignment"
  | "escalation"
  | "moderation"
  | "onboarding"
  | "dispute"
  | "sla_breached";

// --- Priority derivation ----------------------------------------------------
function derivePriority(workflow: WorkflowKey, state: string, slaMin: number | null, data: any): QueuePriority {
  if (state === "escalated") return "urgent";
  if (slaMin !== null && slaMin <= 0) return "urgent";
  if (slaMin !== null && slaMin <= 30) return "high";
  const sev = data?.severity;
  if (sev === "critical") return "urgent";
  if (sev === "high") return "high";
  if (state === "pending" || state === "open" || state === "claimed") return "normal";
  return "low";
}

const PRIORITY_RANK: Record<QueuePriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function toItem(workflow: WorkflowKey, rec: EntityRecord): QueueItem {
  const slaMin = slaRemainingMinutes(workflow, rec.state, new Date(rec.enteredAt));
  const breached = slaMin !== null && slaMin <= 0;
  return {
    id: rec.id, workflow, state: rec.state,
    priority: derivePriority(workflow, rec.state, slaMin, rec.data),
    slaMinutes: slaMin, breached,
    enteredAt: rec.enteredAt, record: rec,
  };
}

function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    // Both finite slaMinutes: smaller (more urgent) first.
    const aS = a.slaMinutes ?? Number.POSITIVE_INFINITY;
    const bS = b.slaMinutes ?? Number.POSITIVE_INFINITY;
    if (aS !== bS) return aS - bS;
    return a.enteredAt.localeCompare(b.enteredAt);
  });
}

// --- Queue selectors --------------------------------------------------------
export function assignmentQueue(store: OrchestrationStore): QueueItem[] {
  // Open + claimed bookings awaiting dispatcher visibility.
  const open = store.repos.booking.listUnclaimed().filter(r => r.state === "pending");
  const claimed = store.repos.booking.list().filter(r => r.state === "claimed");
  return sortQueue([...open, ...claimed].map(r => toItem("booking", r)));
}

export function escalationQueue(store: OrchestrationStore): QueueItem[] {
  const bookings = store.repos.booking.list().filter(r => r.state === "escalated");
  const escalations = store.repos.escalation.list().filter(r => r.state !== "resolved");
  return sortQueue([
    ...bookings.map(r => toItem("booking", r)),
    ...escalations.map(r => toItem("escalation", r)),
  ]);
}

export function moderationQueue(store: OrchestrationStore): QueueItem[] {
  const escalatedBookings = store.repos.booking.list().filter(r => r.state === "escalated");
  const incidents = store.repos.incident.list().filter(r => r.state !== "resolved");
  const complaints = store.repos.complaint.list().filter(r => r.state !== "resolved");
  return sortQueue([
    ...escalatedBookings.map(r => toItem("booking", r)),
    ...incidents.map(r => toItem("incident", r)),
    ...complaints.map(r => toItem("complaint", r)),
  ]);
}

export function onboardingQueue(store: OrchestrationStore): QueueItem[] {
  // Onboarding lifecycle isn't a first-class workflow yet — surface any
  // entities tagged with kind=onboarding for forward-compat, plus return [].
  const candidates = store.repos.booking.list().filter(r => r.data?.kind === "onboarding");
  return sortQueue(candidates.map(r => toItem("booking", r)));
}

export function disputeQueue(store: OrchestrationStore): QueueItem[] {
  return sortQueue(
    store.repos.dispute.list()
      .filter(r => r.state !== "resolved")
      .map(r => toItem("dispute", r)),
  );
}

export function slaBreachedQueue(store: OrchestrationStore): QueueItem[] {
  const all: QueueItem[] = [];
  (Object.keys(store.repos) as WorkflowKey[]).forEach(w => {
    store.repos[w].list().forEach(rec => {
      const it = toItem(w, rec);
      if (it.breached) all.push(it);
    });
  });
  return sortQueue(all);
}

const RAW_QUEUE_SELECTORS: Record<QueueName, (s: OrchestrationStore) => QueueItem[]> = {
  assignment:   assignmentQueue,
  escalation:   escalationQueue,
  moderation:   moderationQueue,
  onboarding:   onboardingQueue,
  dispute:      disputeQueue,
  sla_breached: slaBreachedQueue,
};

/**
 * Phase 7A-R2 — memoized queue access.
 *
 * Without this, every render allocated fresh QueueItem objects (and
 * `slaRemainingMinutes` drifts with `Date.now()`), tripping React's
 * snapshot-stability check (error #185) when consumed via
 * useSyncExternalStore. We key the cache on the store's monotonic
 * `version`, so derived queues stay referentially stable until a real
 * mutation occurs.
 */
const QUEUE_CACHE = new WeakMap<OrchestrationStore, { version: number; items: Partial<Record<QueueName, QueueItem[]>> }>();

function memoizedQueue(name: QueueName, store: OrchestrationStore): QueueItem[] {
  let entry = QUEUE_CACHE.get(store);
  if (!entry || entry.version !== store.version) {
    entry = { version: store.version, items: {} };
    QUEUE_CACHE.set(store, entry);
  }
  const cached = entry.items[name];
  if (cached) return cached;
  const fresh = RAW_QUEUE_SELECTORS[name](store);
  entry.items[name] = fresh;
  return fresh;
}

export const QUEUE_SELECTORS: Record<QueueName, (s: OrchestrationStore) => QueueItem[]> = {
  assignment:   (s) => memoizedQueue("assignment",   s),
  escalation:   (s) => memoizedQueue("escalation",   s),
  moderation:   (s) => memoizedQueue("moderation",   s),
  onboarding:   (s) => memoizedQueue("onboarding",   s),
  dispute:      (s) => memoizedQueue("dispute",      s),
  sla_breached: (s) => memoizedQueue("sla_breached", s),
};

export const QUEUE_LABEL: Record<QueueName, string> = {
  assignment:   "Assignment queue",
  escalation:   "Escalation queue",
  moderation:   "Moderation queue",
  onboarding:   "Onboarding queue",
  dispute:      "Dispute queue",
  sla_breached: "SLA breached",
};
