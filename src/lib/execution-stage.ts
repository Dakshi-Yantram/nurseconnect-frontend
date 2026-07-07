/**
 * Phase 7A — Guided execution stage derivation.
 *
 * Translates a booking entity (state + readiness flags) into a guided
 * operational stage label so worker UI can render a coherent progression
 * strip instead of a single status chip. Pure function — no state.
 *
 * Workflow remains authoritative; this is a presentation-layer rollup
 * that surfaces *why* the next transition isn't available yet (consent
 * missing, checklist pending, etc.). It mirrors engine guard semantics.
 */
import type { EntityRecord } from "@/lib/orchestration/repositories";
import { bindStatus } from "@/lib/workflow-bind";


export type ExecutionStageKey =
  | "claimed"
  | "ready_for_visit"
  | "check_in_pending"
  | "in_progress"
  | "consent_pending"
  | "checklist_pending"
  | "documentation_pending"
  | "ready_for_completion"
  | "escalated"
  | "completed"
  | "cancelled"
  | "pending";

export interface ExecutionStage {
  key: ExecutionStageKey;
  label: string;
  description: string;
  tone: "muted" | "info" | "primary" | "warning" | "success" | "danger";
}

const STAGE_META: Record<ExecutionStageKey, Omit<ExecutionStage, "key">> = {
  pending:               { label: "Open in marketplace",   tone: "warning", description: "Awaiting a professional to claim." },
  claimed:               { label: "Claimed — accept next", tone: "info",    description: "Accept the assignment to lock in your visit window." },
  ready_for_visit:       { label: "Ready for visit",       tone: "info",    description: "Travel to the patient and confirm consent on arrival." },
  check_in_pending:      { label: "Consent then check in", tone: "warning", description: "Confirm patient consent before checking in." },
  in_progress:           { label: "Visit in progress",     tone: "primary", description: "Capture the clinical checklist and documentation." },
  consent_pending:       { label: "Consent pending",       tone: "warning", description: "Patient consent must be confirmed to proceed." },
  checklist_pending:     { label: "Checklist pending",     tone: "warning", description: "Complete the clinical checklist before checkout." },
  documentation_pending: { label: "Documentation pending", tone: "warning", description: "Finish visit documentation to enable checkout." },
  ready_for_completion:  { label: "Ready to check out",    tone: "success", description: "All readiness checks satisfied — check out to close the visit." },
  escalated:             { label: "Escalated",             tone: "danger",  description: "Awaiting clinical/ops resolution before continuing." },
  completed:             { label: "Completed",             tone: "success", description: "Visit closed and submitted." },
  cancelled:             { label: "Cancelled",             tone: "muted",   description: "Visit cancelled." },
};

export function deriveExecutionStage(rec: EntityRecord | undefined | null): ExecutionStage {
  const fallback = (key: ExecutionStageKey): ExecutionStage => ({ key, ...STAGE_META[key] });
  if (!rec) return fallback("pending");
  const d: any = rec.data ?? {};
  const canonicalState = bindStatus("booking", rec.state);
  switch (canonicalState) {
    case "pending":   return fallback("pending");
    case "claimed":   return fallback("claimed");
    case "active": {
      const consentAccepted = !!(d.consentAccepted ?? d.consent_accepted);
      return fallback(consentAccepted ? "ready_for_visit" : "check_in_pending");
    }
    case "in_progress": {
      const checklistComplete = !!(d.checklistComplete ?? d.clinicalChecklistComplete ?? d.checklist_complete);
      const documentationComplete = !!(d.documentationComplete ?? d.documentation_done ?? d.visitDocumentationComplete);
      if (!checklistComplete) return fallback("checklist_pending");
      if (!documentationComplete) return fallback("documentation_pending");
      return fallback("ready_for_completion");
    }
    case "escalated": return fallback("escalated");
    case "completed": return fallback("completed");
    case "cancelled": return fallback("cancelled");
    default:          return fallback("in_progress");
  }
}

/** Ordered stages for visual progression strip (excludes terminal/escalated). */
export const PROGRESSION_ORDER: ExecutionStageKey[] = [
  "claimed", "ready_for_visit", "in_progress", "ready_for_completion", "completed",
];

export function progressIndex(stage: ExecutionStageKey): number {
  // Map sub-stages to their nearest milestone for the linear strip.
  switch (stage) {
    case "pending":               return -1;
    case "claimed":               return 0;
    case "ready_for_visit":
    case "check_in_pending":
    case "consent_pending":       return 1;
    case "in_progress":
    case "checklist_pending":
    case "documentation_pending": return 2;
    case "ready_for_completion":  return 3;
    case "completed":             return 4;
    case "escalated":             return 2;
    case "cancelled":             return -1;
  }
}
