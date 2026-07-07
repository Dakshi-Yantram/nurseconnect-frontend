/**
 * Phase 4 — Operational Event Foundation.
 *
 * Centralized event definitions emitted by the orchestration engine.
 * NOT a realtime/websocket layer — purely an in-process bus + typed contracts
 * so future delivery channels (websocket / push / email) can subscribe.
 */
import type { WorkflowKey } from "@/lib/workflows";
import type { ActionKey } from "@/lib/actions";
import type { Role } from "@/lib/rbac";

export type EventKind =
  | "entity.created"
  | "entity.updated"
  | "workflow.transitioned"
  | "workflow.guard_rejected"
  | "workflow.sla_breached"
  | "version.drafted"
  | "version.published";

export interface DomainEvent {
  id: string;
  kind: EventKind;
  workflow: WorkflowKey;
  entityId: string;
  actor: string;
  role: Role | null;
  ts: string;                  // ISO
  from?: string;
  to?: string;
  action?: ActionKey;
  notes?: string;
  payload?: Record<string, unknown>;
}

type Listener = (e: DomainEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();
  emit(e: DomainEvent) { this.listeners.forEach(l => l(e)); }
  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
}

export const bus = new EventBus();

let counter = 0;
export const nextEventId = () => `evt_${Date.now().toString(36)}_${(++counter).toString(36)}`;
