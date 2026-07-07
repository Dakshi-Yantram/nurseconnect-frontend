import type { TimelineItem } from "@/components/shared/Timeline";
import { APPLICATIONS } from "@/lib/mock-data";

export const ONBOARDING_STAGES = [
  "Application Received",
  "Initial Screening",
  "Documents Pending",
  "Document Review",
  "Reference Verification",
  "Background Verification",
  "Clinical Review",
  "Insurance Eligibility",
  "Final Approval",
  "Activated",
  "Rejected",
  "Escalated",
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];
export type ActivityTone = "primary" | "success" | "warning" | "danger" | "muted";
export type ActivityEntry = TimelineItem & { actor: string; type: string; entity?: string; notes?: string; tone?: ActivityTone };
export type WorkflowApplication = (typeof APPLICATIONS)[number] & { history: ActivityEntry[]; reviewer: string; awaitingDocuments?: boolean; escalated?: boolean };

export const nowStamp = () => new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function stageProgress(stage: string) {
  const idx = ONBOARDING_STAGES.indexOf(stage as OnboardingStage);
  if (idx < 0) return 10;
  return Math.round(((idx + 1) / (ONBOARDING_STAGES.length - 2)) * 100);
}

export function stageStatus(stage: string): WorkflowApplication["status"] {
  if (stage === "Activated") return "Ready";
  if (stage === "Rejected") return "Rejected";
  if (stage === "Documents Pending") return "Pending Documents";
  if (stage === "Background Verification") return "Background Check";
  return "In Review";
}

export function seedApplications(): WorkflowApplication[] {
  return APPLICATIONS.map((a, idx) => ({
    ...a,
    stage: ONBOARDING_STAGES[Math.min(idx + 1, 8)],
    progress: stageProgress(ONBOARDING_STAGES[Math.min(idx + 1, 8)]),
    status: stageStatus(ONBOARDING_STAGES[Math.min(idx + 1, 8)]),
    reviewer: idx % 2 ? "clinical-lead@nurseconnect.in" : "ops@nurseconnect.in",
    history: [
      { ts: a.submitted, actor: "Applicant", type: "application_received", title: "Application received", meta: a.name, tone: "muted" },
      { ts: "06 May, 10:20", actor: "ops@nurseconnect.in", type: "review_started", title: "Reviewer assigned", meta: "SLA timer started", tone: "primary" },
      { ts: "07 May, 11:20", actor: "bg-ops@nurseconnect.in", type: "verification", title: `${a.stage} updated`, meta: a.status, tone: a.status === "Rejected" ? "danger" : "warning" },
    ],
  }));
}

export const makeActivity = (type: string, title: string, notes: string, actor = "ops@nurseconnect.in", tone: ActivityTone = "primary"): ActivityEntry => ({
  ts: nowStamp(), actor, type, title, notes, meta: notes, tone,
});
