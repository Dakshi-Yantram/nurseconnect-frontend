/**
 * Phase 4 — Repository / Service Abstraction Layer.
 *
 * Entity-centric, workflow-aware in-memory repositories. Pages should resolve
 * entities through these accessors rather than importing mock-data directly,
 * so the swap to a real backend later becomes a single-file change.
 *
 * Mutations flow through `OrchestrationStore.executeTransition()`, never
 * direct repo writes from screens.
 */
import { COMPLAINTS, DISPUTES, INCIDENTS, PAYOUTS, ACTIVE_VISITS, DEMO_CONSUMER_OWNER_ID, resolvePatientIdByName } from "@/lib/mock-data";
import type { WorkflowKey } from "@/lib/workflows";

export interface EntityRecord {
  id: string;
  workflow: WorkflowKey;
  state: string;
  enteredAt: string;        // ISO of last state-entry
  data: Record<string, any>;
}

export type Repository = {
  workflow: WorkflowKey;
  list(): EntityRecord[];
  get(id: string): EntityRecord | undefined;
};

export class InMemoryRepository implements Repository {
  workflow: WorkflowKey;
  private rows = new Map<string, EntityRecord>();
  // Cached snapshot — MUST be stable across reads with no mutation, otherwise
  // useSyncExternalStore loops infinitely (React error #185).
  private listCache: EntityRecord[] | null = null;
  constructor(workflow: WorkflowKey, seed: EntityRecord[]) {
    this.workflow = workflow;
    seed.forEach(r => this.rows.set(r.id, r));
  }
  list() {
    if (!this.listCache) this.listCache = [...this.rows.values()];
    return this.listCache;
  }
  get(id: string) { return this.rows.get(id); }
  upsert(rec: EntityRecord) { this.rows.set(rec.id, rec); this.listCache = null; }

  // ---- Phase 6B+A: ownership-aware accessors --------------------------------
  // Pure derivations from list() — no extra caches so they stay reactive.
  listByOwner(ownerId: string): EntityRecord[] {
    return this.list().filter(r => r.data?.ownerId === ownerId);
  }
  listUnclaimed(): EntityRecord[] {
    return this.list().filter(r => !r.data?.claimedBy);
  }
  listClaimedBy(claimantId: string): EntityRecord[] {
    return this.list().filter(r => r.data?.claimedBy === claimantId);
  }
}

// Seed builders — coerce existing mock data into the unified shape ----------
const nowIso = () => new Date().toISOString();

function seedComplaints(): EntityRecord[] {
  return COMPLAINTS.map(c => ({
    id: c.id, workflow: "complaint" as const,
    state: c.status, enteredAt: nowIso(),
    data: { ...c },
  }));
}
function seedDisputes(): EntityRecord[] {
  return DISPUTES.map(d => ({
    id: d.id, workflow: "dispute" as const,
    state: d.status, enteredAt: nowIso(),
    data: { ...d },
  }));
}
function seedIncidents(): EntityRecord[] {
  return INCIDENTS.map(i => ({
    id: i.id, workflow: "incident" as const,
    state: i.status, enteredAt: nowIso(),
    data: { ...i },
  }));
}
function seedPayouts(): EntityRecord[] {
  return PAYOUTS.map(p => ({
    id: p.id, workflow: "payout" as const,
    state: (p as any).status ?? "pending", enteredAt: nowIso(),
    data: { ...p },
  }));
}
function seedBookings(): EntityRecord[] {
  // Phase 8C — stamp seed bookings with the demo consumer ownerId so the
  // longitudinal care runtime renders for the demo account under the new
  // ownership-scoped snapshot. Real bookings created via the consumer
  // surface already carry the authenticated owner id.
  // Phase 9B — also stamp the canonical `patientName` alias so link
  // helpers (bookingPatientName / bookingPatientId) read consistently
  // regardless of which legacy field a downstream surface samples.
  return ACTIVE_VISITS.map(v => ({
    id: v.id, workflow: "booking" as const,
    state: v.status, enteredAt: nowIso(),
    // Phase 6C — legacy seed bookings predate consent capture; stamp them so
    // engine guards (CONSENT_REQUIRED) don't block already-running visits.
    // Phase 8D — stamp the resolved stable patient id alongside the legacy
    // patient display string so continuity queries link through identity.
    data: {
      ...v,
      patientId:    resolvePatientIdByName(v.patient),
      patientName:  v.patient,
      patient_name: v.patient,
      nurseName:    v.nurse,
      ownerId:      DEMO_CONSUMER_OWNER_ID,
      ownerRole:    "consumer",
      consentAccepted: true, consentAt: nowIso(),
    },
  }));
}

export function buildRepositories(): Record<WorkflowKey, InMemoryRepository> {
  return {
    booking:    new InMemoryRepository("booking",    []),
    complaint:  new InMemoryRepository("complaint",  seedComplaints()),
    dispute:    new InMemoryRepository("dispute",    seedDisputes()),
    incident:   new InMemoryRepository("incident",   seedIncidents()),
    payout:     new InMemoryRepository("payout",     seedPayouts()),
    escalation: new InMemoryRepository("escalation", []),
    rematch:    new InMemoryRepository("rematch",    []),
    package:    new InMemoryRepository("package",    []),
  };
}
