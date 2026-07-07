/**
 * Phase 4 — Operational History / Timeline Architecture.
 *
 * A single chronological log keyed by (workflow, entityId). Built from
 * DomainEvents emitted by the orchestration engine so every page can render
 * the lifecycle of any entity via <OperationalTimeline />.
 */
import type { DomainEvent } from "./events";
import type { WorkflowKey } from "@/lib/workflows";

export type TimelineTone = "primary" | "success" | "warning" | "danger" | "muted" | "info";

export interface TimelineEntry {
  id: string;
  ts: string;            // ISO
  title: string;
  meta?: string;
  actor: string;
  tone: TimelineTone;
  kind: DomainEvent["kind"];
  workflow: WorkflowKey;
  entityId: string;
  from?: string;
  to?: string;
  notes?: string;
}

const key = (w: WorkflowKey, id: string) => `${w}:${id}`;
const EMPTY: TimelineEntry[] = Object.freeze([]) as unknown as TimelineEntry[];

export class HistoryStore {
  private entries = new Map<string, TimelineEntry[]>();

  seed(entries: TimelineEntry[]) {
    for (const e of entries) {
      const k = key(e.workflow, e.entityId);
      const arr = this.entries.get(k) ?? [];
      arr.push(e);
      this.entries.set(k, arr);
    }
  }

  record(entry: TimelineEntry) {
    const k = key(entry.workflow, entry.entityId);
    // Create a NEW array on mutation so memoized snapshots upstream detect change,
    // but return the same reference between mutations (see for()).
    const arr = [entry, ...(this.entries.get(k) ?? [])];
    this.entries.set(k, arr);
  }

  for(workflow: WorkflowKey, entityId: string): TimelineEntry[] {
    // Return shared frozen EMPTY when missing — stable reference required
    // by useSyncExternalStore to avoid React error #185 (infinite loop).
    return this.entries.get(key(workflow, entityId)) ?? EMPTY;
  }

  recent(limit = 20): TimelineEntry[] {
    return [...this.entries.values()].flat()
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, limit);
  }
}

export function eventToEntry(e: DomainEvent): TimelineEntry {
  const tone: TimelineTone =
      e.kind === "workflow.guard_rejected" ? "danger"
    : e.kind === "workflow.sla_breached"   ? "warning"
    : e.kind === "version.published"        ? "success"
    : e.kind === "version.drafted"          ? "muted"
    : e.kind === "entity.created"           ? "muted"
    : "primary";
  const title =
      e.kind === "workflow.transitioned"   ? `Transitioned ${e.from ?? "?"} → ${e.to ?? "?"}`
    : e.kind === "workflow.guard_rejected" ? `Transition blocked: ${e.from} → ${e.to}`
    : e.kind === "version.drafted"          ? `Draft saved`
    : e.kind === "version.published"        ? `Version published`
    : e.kind === "entity.created"           ? `Entity created`
    : e.kind === "entity.updated"           ? `Entity updated`
    : `SLA breached`;
  return {
    id: e.id, ts: e.ts, title, meta: e.notes ?? e.action,
    actor: e.actor, tone, kind: e.kind,
    workflow: e.workflow, entityId: e.entityId,
    from: e.from, to: e.to, notes: e.notes,
  };
}
