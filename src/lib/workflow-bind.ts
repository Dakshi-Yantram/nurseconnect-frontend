/**
 * Workflow Binding Layer (Phase 3).
 *
 * Bridges legacy mock-data status strings (free-form) into the centralized
 * workflow registry so screens can render via `<StatusBadge>`, `<SLAIndicator>`,
 * and `nextStates()` without hardcoding labels or tones.
 *
 * Screens MUST call `bindStatus(workflow, raw)` instead of mapping statuses
 * inline. New data sources should emit registry state keys directly.
 */
import { WORKFLOWS, type WorkflowKey } from "./workflows";

/** Per-workflow alias table → canonical registry state. */
const ALIASES: Partial<Record<WorkflowKey, Record<string, string>>> = {
  // booking: intentionally empty — WORKFLOWS.booking.states now matches
  // app/models/enums.py BookingStatus values directly (pending_payment,
  // confirmed, assigned, worker_en_route, worker_arrived, in_progress,
  // completed, cancelled, missed, rematch_pending, disputed), so no
  // aliasing is needed. The old aliases here (pending_payment→in_progress,
  // confirmed→active, etc.) were mapping real backend statuses to
  // mock-era state names, mislabeling every booking's status badge.
  escalation: {
    "in_progress":   "investigating",
    "in progress":   "investigating",
    review:          "investigating",
  },
  complaint: {
    in_progress:     "investigating",
    "in progress":   "investigating",
  },
  dispute: {
    split_resolution:  "investigating",
    resolved_refunded: "resolved",
    on_hold:           "investigating",
  },
  payout: {
    approved:   "completed",
    processing: "active",
    paid:       "completed",
    rejected:   "failed",
  },
  incident: {
    in_progress: "investigating",
    open:        "open",
  },
  rematch: {
    in_progress: "in_progress",
  },
  package: {
    paused: "on_hold",
  },
};

/**
 * Canonicalize a raw status into a registry state for the given workflow.
 * Falls back to the workflow's initial state when the raw value is unknown.
 */
export function bindStatus(workflow: WorkflowKey, raw: string | null | undefined): string {
  if (!raw) return WORKFLOWS[workflow].initial;
  const key = String(raw).toLowerCase().trim();
  const alias = ALIASES[workflow]?.[key];
  if (alias && WORKFLOWS[workflow].states[alias]) return alias;
  if (WORKFLOWS[workflow].states[key]) return key;
  return WORKFLOWS[workflow].initial;
}

/** Parse mock "raised" / "created" labels ("2h ago", ISO date) → Date. */
export function parseEnteredAt(raw: string | undefined): Date {
  if (!raw) return new Date();
  if (/ago$/i.test(raw)) {
    const m = raw.match(/(\d+)\s*([smhd])/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const ms = unit === "s" ? n * 1000
               : unit === "m" ? n * 60_000
               : unit === "h" ? n * 3_600_000
               :                 n * 86_400_000;
      return new Date(Date.now() - ms);
    }
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}
