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

// Booking status labels/tones — mirrors app/models/enums.py BookingStatus
// exactly, since this workflow now renders real backend values directly
// (bindStatus previously fell back to a mock-era "pending/claimed/active"
// vocabulary that the backend never emits, silently mislabeling every
// booking from "nurse accepted" through "nurse arrived").
const BOOKING_STATUS_PRESETS: Record<string, Omit<StatusMeta, "next">> = {
  draft:            { label: "Draft",              tone: "muted",   phase: "intake" },
  pending_payment:  { label: "Pending Payment",     tone: "warning", phase: "intake" },
  confirmed:        { label: "Confirmed",           tone: "info",    phase: "intake" },
  assigned:         { label: "Nurse Assigned",      tone: "primary", phase: "active" },
  worker_en_route:  { label: "Nurse On The Way",    tone: "primary", phase: "active" },
  worker_arrived:   { label: "Nurse Arrived",       tone: "primary", phase: "active" },
  in_progress:      { label: "Visit In Progress",   tone: "primary", phase: "active" },
  completed:        { label: "Completed",           tone: "success", phase: "terminal" },
  cancelled:        { label: "Cancelled",           tone: "muted",   phase: "terminal" },
  missed:           { label: "Missed",              tone: "danger",  phase: "terminal" },
  rematch_pending:  { label: "Finding New Nurse",   tone: "warning", phase: "blocked" },
  disputed:         { label: "Disputed",            tone: "danger",  phase: "review" },
};
function bs(key: keyof typeof BOOKING_STATUS_PRESETS, next: string[], extra: Partial<StatusMeta> = {}): StatusMeta {
  return { ...BOOKING_STATUS_PRESETS[key], next, ...extra };
}

export const WORKFLOWS: Record<WorkflowKey, WorkflowDef> = {
  booking: {
    key: "booking", label: "Booking", portal: "shared", initial: "pending_payment",
    states: {
      draft:            bs("draft",            ["pending_payment", "cancelled"]),
      pending_payment:  bs("pending_payment",   ["confirmed", "cancelled"], { slaMinutes: 30 }),
      confirmed:        bs("confirmed",         ["assigned", "rematch_pending", "cancelled"], { slaMinutes: 60 }),
      assigned:         bs("assigned",          ["worker_en_route", "rematch_pending", "cancelled"], { slaMinutes: 60 }),
      worker_en_route:  bs("worker_en_route",   ["worker_arrived", "cancelled"]),
      worker_arrived:   bs("worker_arrived",    ["in_progress", "cancelled"]),
      in_progress:      bs("in_progress",       ["completed", "disputed", "missed"]),
      rematch_pending:  bs("rematch_pending",   ["assigned", "cancelled"], { slaMinutes: 45 }),
      disputed:         bs("disputed",          ["completed", "cancelled"], { slaMinutes: 24 * 60 }),
      completed:        bs("completed",         []),
      cancelled:        bs("cancelled",         []),
      missed:           bs("missed",            []),
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
