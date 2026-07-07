import type { Role } from "./rbac";
import { ROLE_PORTAL } from "./rbac";

/**
 * Action-level permission registry.
 *
 * Phase 1 controlled which routes a role could load.
 * Phase 2 controls which *actions* a role can perform inside those routes —
 * resolve a dispute, escalate a case, check-in a visit, raise a complaint, etc.
 *
 * Pages MUST consume `can(role, action)` / `useAction()` / `<ActionGate>`
 * instead of inlining role literals next to buttons.
 */

export type ActionKey =
  // Admin — operations
  | "ops.rematch"
  | "ops.assign"
  | "ops.escalate"
  | "ops.intervene"
  // Admin — clinical
  | "clinical.escalate"
  | "clinical.resolve"
  | "clinical.review_insurance"
  // Admin — finance
  | "finance.resolve_dispute"
  | "finance.adjust_ledger"
  | "finance.approve_payout"
  // Admin — users
  | "users.approve_nurse"
  | "users.reject_nurse"
  | "users.suspend"
  // Admin — trust
  | "trust.resolve_incident"
  | "trust.resolve_complaint"
  // Consumer
  | "consumer.create_booking"
  | "consumer.cancel_booking"
  | "consumer.manage_consent"
  | "consumer.raise_complaint"
  | "consumer.make_payment"
  | "consumer.add_patient"
  // Worker — marketplace claim lifecycle
  | "worker.claim_assignment"
  | "worker.release_assignment"
  | "worker.accept_assignment"
  | "worker.decline_assignment"
  | "worker.check_in"
  | "worker.check_out"
  | "worker.submit_documentation"
  | "worker.escalate_visit"
  | "worker.update_availability"
  | "worker.submit_onboarding"
  // Moderation — reviewer / trainer
  | "moderation.review_submission"
  | "moderation.approve_submission"
  | "moderation.reject_submission"
  | "moderation.review_training";

const ROLE_ACTIONS: Record<Role, ActionKey[]> = {
  super_admin: [
    "ops.rematch","ops.assign","ops.escalate","ops.intervene",
    "clinical.escalate","clinical.resolve","clinical.review_insurance",
    "finance.resolve_dispute","finance.adjust_ledger","finance.approve_payout",
    "users.approve_nurse","users.reject_nurse","users.suspend",
    "trust.resolve_incident","trust.resolve_complaint",
  ],
  admin: [
    "ops.rematch","ops.assign","ops.escalate","ops.intervene",
    "clinical.escalate","clinical.resolve","clinical.review_insurance",
    "finance.resolve_dispute","finance.adjust_ledger","finance.approve_payout",
    "users.approve_nurse","users.reject_nurse","users.suspend",
    "trust.resolve_incident","trust.resolve_complaint",
  ],
  support: [
    "trust.resolve_incident","trust.resolve_complaint",
  ],
  consumer: [
    "consumer.create_booking","consumer.cancel_booking",
    "consumer.manage_consent","consumer.raise_complaint","consumer.make_payment",
    "consumer.add_patient",
  ],
  partner: [
    "worker.claim_assignment","worker.release_assignment",
    "worker.accept_assignment","worker.decline_assignment",
    "worker.check_in","worker.check_out",
    "worker.submit_documentation","worker.escalate_visit",
    "worker.update_availability","worker.submit_onboarding",
  ],
};
export function can(role: Role | null, action: ActionKey): boolean {
  if (!role) return false;
  return ROLE_ACTIONS[role]?.includes(action) ?? false;
}

export function actionsForRole(role: Role | null): ActionKey[] {
  return role ? ROLE_ACTIONS[role] : [];
}

export function actionPortal(action: ActionKey): "admin" | "consumer" | "worker" | "moderation" {
  if (action.startsWith("consumer."))   return "consumer";
  if (action.startsWith("worker."))     return "worker";
  if (action.startsWith("moderation.")) return "moderation";
  return "admin";
}

export function isActionAllowedInPortal(role: Role | null, action: ActionKey): boolean {
  if (!role) return false;
  return ROLE_PORTAL[role] === actionPortal(action) && can(role, action);
}
