import type { ActionKey } from "./actions";
import type { Portal } from "./rbac";

/**
 * Centralized workflow + state registry.
 *
 * Single source of truth for every operational workflow's:
 *   - states (typed string union per workflow)
 *   - allowed transitions (state → next states)
 *   - role-driven actions per state
 *   - severity / priority metadata
 *   - SLA windows (minutes)
 *   - display labels + tones
 *   - portal scope
 *
 * Screens MUST consume this registry instead of hardcoding statuses,
 * SLA windows, or transition logic.
 */

export type WorkflowKey =
  | "booking"
  | "escalation"
  | "complaint"
  | "dispute"
  | "payout"
  | "rematch"
  | "incident"
  | "package";

export type Severity = "low" | "medium" | "high" | "critical";
export type Priority = "low" | "normal" | "high" | "urgent";

export type StatusTone = "muted" | "info" | "primary" | "success" | "warning" | "danger";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Logical phase grouping for UI rollups. */
  phase: "intake" | "active" | "blocked" | "review" | "terminal";
  /** SLA window (minutes) from entering this state until next action expected. */
  slaMinutes?: number;
  /** Allowed next states. */
  next: string[];
  /** Actions that may be performed while in this state. */
  actions?: ActionKey[];
}

export interface WorkflowDef<S extends string = string> {
  key: WorkflowKey;
  label: string;
  portal: Portal | "shared";
  initial: S;
  states: Record<S, StatusMeta>;
}

// Re-usable status palette ----------------------------------------------------
export const STATUS_PRESETS: Record<string, Omit<StatusMeta, "next">> = {
  open:           { label: "Open",          tone: "warning", phase: "intake" },
  pending:        { label: "Pending",       tone: "warning", phase: "intake" },
  claimed:        { label: "Claimed",       tone: "info",    phase: "intake" },
  active:         { label: "Active",        tone: "primary", phase: "active" },
  in_progress:    { label: "In Progress",   tone: "primary", phase: "active" },
  investigating:  { label: "Investigating", tone: "info",    phase: "review" },
  on_hold:        { label: "On Hold",       tone: "muted",   phase: "blocked" },
  escalated:      { label: "Escalated",     tone: "danger",  phase: "review" },
  resolved:       { label: "Resolved",      tone: "success", phase: "terminal" },
  completed:      { label: "Completed",     tone: "success", phase: "terminal" },
  failed:         { label: "Failed",        tone: "danger",  phase: "terminal" },
  cancelled:      { label: "Cancelled",     tone: "muted",   phase: "terminal" },
};

// Severity / priority --------------------------------------------------------
export const SEVERITY_META: Record<Severity, { label: string; tone: StatusTone; slaMinutes: number }> = {
  low:      { label: "Low",      tone: "muted",   slaMinutes: 24 * 60 },
  medium:   { label: "Medium",   tone: "info",    slaMinutes: 8 * 60 },
  high:     { label: "High",     tone: "warning", slaMinutes: 2 * 60 },
  critical: { label: "Critical", tone: "danger",  slaMinutes: 30 },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: StatusTone }> = {
  low:    { label: "Low",    tone: "muted" },
  normal: { label: "Normal", tone: "info" },
  high:   { label: "High",   tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

// Workflow definitions -------------------------------------------------------
function s(preset: keyof typeof STATUS_PRESETS, next: string[], extra: Partial<StatusMeta> = {}): StatusMeta {
  return { ...STATUS_PRESETS[preset], next, ...extra };
}

export const WORKFLOWS: Record<WorkflowKey, WorkflowDef> = {
  booking: {
    key: "booking", label: "Booking", portal: "shared", initial: "pending",
    states: {
      pending:      s("pending",     ["claimed","active","cancelled"],    { slaMinutes: 30, actions: ["ops.assign","worker.claim_assignment","consumer.cancel_booking"] }),
      claimed:      s("claimed",     ["active","pending","cancelled"],    { slaMinutes: 60, actions: ["worker.accept_assignment","worker.release_assignment","worker.decline_assignment","ops.assign"] }),
      active:       s("active",      ["in_progress","cancelled"],          { actions: ["worker.check_in","worker.release_assignment"] }),
      in_progress:  s("in_progress", ["completed","escalated"],            { actions: ["worker.check_out","worker.escalate_visit"] }),
      escalated:    s("escalated",   ["in_progress","cancelled"],          { slaMinutes: 60, actions: ["ops.escalate","ops.intervene","clinical.escalate"] }),
      completed:    s("completed",   []),
      cancelled:    s("cancelled",   []),
    },
  },
  escalation: {
    key: "escalation", label: "Clinical Escalation", portal: "admin", initial: "open",
    states: {
      open:          s("open",          ["investigating","resolved"], { slaMinutes: 30, actions: ["clinical.escalate"] }),
      investigating: s("investigating", ["resolved","escalated"],     { slaMinutes: 120, actions: ["clinical.resolve","clinical.escalate"] }),
      escalated:     s("escalated",     ["resolved"],                 { slaMinutes: 60 }),
      resolved:      s("resolved",      []),
    },
  },
  complaint: {
    key: "complaint", label: "Complaint", portal: "shared", initial: "open",
    states: {
      open:          s("open",          ["investigating","resolved"], { slaMinutes: 240, actions: ["trust.resolve_complaint"] }),
      investigating: s("investigating", ["resolved","escalated"],     { slaMinutes: 24 * 60 }),
      escalated:     s("escalated",     ["resolved"]),
      resolved:      s("resolved",      []),
    },
  },
  dispute: {
    key: "dispute", label: "Dispute", portal: "admin", initial: "open",
    states: {
      open:          s("open",          ["investigating","resolved"], { slaMinutes: 24 * 60, actions: ["finance.resolve_dispute"] }),
      investigating: s("investigating", ["resolved","escalated"]),
      escalated:     s("escalated",     ["resolved"]),
      resolved:      s("resolved",      []),
    },
  },
  payout: {
    key: "payout", label: "Payout", portal: "admin", initial: "pending",
    states: {
      pending:   s("pending",   ["active","failed"],     { actions: ["finance.approve_payout"] }),
      active:    s("active",    ["completed","failed"]),
      completed: s("completed", []),
      failed:    s("failed",    ["pending"]),
    },
  },
  rematch: {
    key: "rematch", label: "Rematch", portal: "admin", initial: "open",
    states: {
      open:        s("open",        ["in_progress","cancelled"], { slaMinutes: 30, actions: ["ops.rematch","ops.assign"] }),
      in_progress: s("in_progress", ["completed","escalated"]),
      escalated:   s("escalated",   ["completed","cancelled"]),
      completed:   s("completed",   []),
      cancelled:   s("cancelled",   []),
    },
  },
  incident: {
    key: "incident", label: "Incident", portal: "admin", initial: "open",
    states: {
      open:          s("open",          ["investigating","resolved"], { slaMinutes: 60, actions: ["trust.resolve_incident"] }),
      investigating: s("investigating", ["resolved","escalated"]),
      escalated:     s("escalated",     ["resolved"]),
      resolved:      s("resolved",      []),
    },
  },
  package: {
    key: "package", label: "Care Package", portal: "admin", initial: "pending",
    states: {
      pending:   s("pending",   ["active","cancelled"]),
      active:    s("active",    ["on_hold","completed","cancelled"]),
      on_hold:   s("on_hold",   ["active","cancelled"]),
      completed: s("completed", []),
      cancelled: s("cancelled", []),
    },
  },
};

// Helpers --------------------------------------------------------------------
export function getWorkflow(key: WorkflowKey): WorkflowDef {
  return WORKFLOWS[key];
}

export function getStatusMeta(key: WorkflowKey, state: string): StatusMeta | undefined {
  return WORKFLOWS[key]?.states[state];
}

export function canTransition(key: WorkflowKey, from: string, to: string): boolean {
  return !!WORKFLOWS[key]?.states[from]?.next.includes(to);
}

export function nextStates(key: WorkflowKey, from: string): string[] {
  return WORKFLOWS[key]?.states[from]?.next ?? [];
}

export function actionsForState(key: WorkflowKey, state: string): ActionKey[] {
  return WORKFLOWS[key]?.states[state]?.actions ?? [];
}

/** Minutes remaining until SLA breach given the state-entered timestamp. */
export function slaRemainingMinutes(key: WorkflowKey, state: string, enteredAt: Date): number | null {
  const meta = getStatusMeta(key, state);
  if (!meta?.slaMinutes) return null;
  const elapsed = (Date.now() - enteredAt.getTime()) / 60000;
  return Math.round(meta.slaMinutes - elapsed);
}
