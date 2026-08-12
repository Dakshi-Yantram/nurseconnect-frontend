/**
 * Phase 5 — Shared operational journey components.
 *
 * Workflow-, repository-, and permission-aware panels reused across portals.
 * Pages compose these instead of rebuilding status/action/timeline blocks.
 *
 * All panels resolve state through the orchestration repositories and emit
 * mutations through useTransition() — never via direct entity mutation.
 */
import { useMemo } from "react";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { EmptyState } from "@/components/shared/EmptyState";
import { OperationalTimeline } from "@/components/shared/OperationalTimeline";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { SchemaForm } from "@/lib/forms/SchemaForm";
import { ExecutionProgress } from "@/components/journey/ExecutionProgress";
import { ExecutionBlockers } from "@/components/journey/ExecutionBlockers";
import { LifecycleContinuityStrip } from "@/components/journey/LifecycleContinuity";
import { RuntimeBoundary } from "@/components/shared/RuntimeBoundary";
import { deriveExecutionStage } from "@/lib/execution-stage";
import { getChecklistForBooking, getDocumentationForBooking } from "@/lib/forms/templates";
import { useEntity, useOrchestration, useTransition, useVisitLifecycle } from "@/lib/orchestration";
import { bookingPatientName } from "@/lib/orchestration/links";
import { useAuth } from "@/lib/auth-context";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import {
  actionsForState, nextStates, type WorkflowKey,
} from "@/lib/workflows";
import type { ActionKey } from "@/lib/actions";
import { can } from "@/lib/actions";
import { History as HistoryIcon, ClipboardList, ShieldCheck, Package as PackageIcon, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
// ---------------------------------------------------------------- Helpers
function labelFor(a: ActionKey): string {
  return a.split(".")[1].replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

/** Maps an action to a transition target — kept narrow to common ops. */
const ACTION_TO_STATE: Partial<Record<ActionKey, string>> = {
  "worker.claim_assignment": "claimed",
  "worker.release_assignment": "pending",
  "worker.accept_assignment": "active",
  "worker.decline_assignment": "cancelled",
  "worker.check_in": "in_progress",
  "worker.check_out": "completed",
  "worker.escalate_visit": "escalated",
  "consumer.cancel_booking": "cancelled",
};

// ---------------------------------------------------------------- No-op
const noop = () => { };

// ---------------------------------------------------------------- Status header
function JourneyHeader({
  workflow, state, enteredAt, title, subtitle,
}: {
  workflow: WorkflowKey; state: string; enteredAt: Date;
  title: React.ReactNode; subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{title}</div>
        {subtitle && <div className="text-[12px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge workflow={workflow} state={state} />
        <SLAIndicator workflow={workflow} state={state} enteredAt={enteredAt} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- History panel
export function OperationalHistoryPanel({
  workflow, entityId, title = "Operational history", limit,
}: { workflow: WorkflowKey; entityId: string; title?: string; limit?: number }) {
  return (
    <Card title={title} action={<HistoryIcon className="h-3.5 w-3.5 text-muted-foreground" />}>
      <OperationalTimeline workflow={workflow} entityId={entityId} limit={limit} />
    </Card>
  );
}

// ---------------------------------------------------------------- Booking
export function BookingJourneyPanel({ bookingId }: { bookingId: string }) {
  const rec = useEntity("booking", bookingId);
  const { user } = useAuth();
  const transition = useTransition();
  const role = user?.role ?? null;
  const actor = user?.email ?? "consumer@nurseconnect.in";

  if (!rec) return <EmptyState title="Booking not found" />;
  const state = bindStatus("booking", rec.state);
  const b: any = rec.data;
  const allowed = actionsForState("booking", state).filter(a => can(role, a));

  return (
    <div className="space-y-4">
      <Card title="Booking">
        <JourneyHeader
          workflow="booking" state={state}
          enteredAt={parseEnteredAt(rec.enteredAt)}
          title={<>#{rec.id} · {b.service ?? "Service"}</>}
          subtitle={<>{bookingPatientName(rec) ?? "—"} · {b.area ?? "—"}</>}
        />
        {allowed.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {allowed.map(a => {
              const to = ACTION_TO_STATE[a];
              if (!to) return null;
              return (
                <WorkflowActionButton key={a} action={a} variant="secondary"
                  onClick={() => transition({ workflow: "booking", entityId: rec.id, to, actor, role, action: a })}>
                  {labelFor(a)}
                </WorkflowActionButton>
              );
            })}
          </div>
        )}
      </Card>
      <OperationalHistoryPanel workflow="booking" entityId={rec.id} title="Booking history" />
    </div>
  );
}

// ---------------------------------------------------------------- Visit execution
export function VisitExecutionPanel({ visitId, readOnly = false }: { visitId: string; readOnly?: boolean }) {
  const rec = useEntity("booking", visitId);
  const store = useOrchestration();
  const { user } = useAuth();
  const transition = useTransition();
  const role = user?.role ?? null;
  const actor = user?.email ?? "worker@nurseconnect.in";

  const lifecycle = useVisitLifecycle(visitId);

  if (!rec) return <EmptyState title="Visit not found" />;
  const state = bindStatus("booking", rec.state);
  const v: any = rec.data;
  const allowed = actionsForState("booking", state).filter(a => can(role, a) && a.startsWith("worker."));
  const checklistSchema = getChecklistForBooking(v);
  const documentationSchema = getDocumentationForBooking(v);

  const move = (action: ActionKey, to: string, message: string) => {
    if (readOnly) return;
    transition({ workflow: "booking", entityId: rec.id, to, actor, role, action }, { successMessage: message });
  };

  const patchData = (patch: Record<string, any>, notes: string) => {
    if (readOnly) return;
    store.patchEntity("booking", rec.id, patch, actor, role, notes);
  };

  // NOTE: backend data uses a fixed set of readiness flags.
  // Keep the panel resilient to field-name drift.
  const consentOk = !!(v.consentAccepted ?? v.consent_accepted);
  const checklistComplete = !!(v.checklistComplete ?? v.clinicalChecklistComplete ?? v.checklist_complete);
  const documentationDone = !!(v.documentationComplete ?? v.documentation_done ?? v.visitDocumentationComplete);
  const stage = lifecycle.stage ?? deriveExecutionStage(rec);

  const checklistEmphasis = stage.key === "checklist_pending"
    ? "ring-1 ring-amber-300/70 shadow-[0_0_0_3px_rgba(251,191,36,0.08)]" : "";
  const documentationEmphasis = stage.key === "documentation_pending"
    ? "ring-1 ring-amber-300/70 shadow-[0_0_0_3px_rgba(251,191,36,0.08)]" : "";

  const checkoutReady = lifecycle.completion.ready && !lifecycle.escalation.active;

  return (
    <div className="space-y-4">
      <Card title="Visit">
        <JourneyHeader
          workflow="booking" state={state}
          enteredAt={parseEnteredAt(rec.enteredAt)}
          title={<>#{rec.id} · {bookingPatientName(rec) ?? "—"}</>}
          subtitle={<>{v.service ?? "Service"} · {v.area ?? "—"}</>}
        />
        <div className="mt-4 space-y-3">
          <ExecutionProgress rec={rec} />
          <LifecycleContinuityStrip
            stage={stage}
            priorStage={lifecycle.priorStage}
            escalation={lifecycle.escalation}
          />
        </div>

        <div className="mt-4">
          <RuntimeBoundary label="Operational blockers">
            <ExecutionBlockers
              rec={rec}
              lifecycle={{
                completion: lifecycle.completion,
                escalation: lifecycle.escalation,
              }}
            />
          </RuntimeBoundary>
        </div>

        {/* Action buttons — all disabled when readOnly */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {allowed.includes("worker.check_in") && (
            <WorkflowActionButton
              action="worker.check_in"
              disabled={readOnly}
              onClick={readOnly ? noop : () => move("worker.check_in", "in_progress", "Checked in")}
            >
              Check in
            </WorkflowActionButton>
          )}
          {allowed.includes("worker.check_out") && (
            <WorkflowActionButton
              action="worker.check_out"
              disabled={readOnly}
              onClick={readOnly ? noop : () => move("worker.check_out", "completed", "Visit completed")}
            >
              Check out
            </WorkflowActionButton>
          )}
          {allowed.includes("worker.check_out") && !checkoutReady && !readOnly && (
            <span className="text-[11.5px] text-amber-700">
              {lifecycle.escalation.active
                ? "Resolve escalation before checkout."
                : `${lifecycle.completion.total - lifecycle.completion.met} readiness item(s) outstanding.`}
            </span>
          )}
          {allowed.includes("worker.escalate_visit") && (
            <WorkflowActionButton
              action="worker.escalate_visit"
              variant="danger"
              disabled={readOnly}
              onClick={readOnly ? noop : () => move("worker.escalate_visit", "escalated", "Visit escalated")}
            >
              Escalate
            </WorkflowActionButton>
          )}
          {allowed.length === 0 && (
            <span className="text-[12px] text-muted-foreground">No actions available in current state.</span>
          )}
        </div>

        {/* Readiness flags */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
          <ReadinessFlag ok={consentOk} label="Patient consent" />
          <ReadinessFlag ok={checklistComplete} label="Clinical checklist" />
          <ReadinessFlag ok={documentationDone} label="Visit documentation" />
        </div>

        {/* Confirm consent — disabled when readOnly */}
        {!consentOk && (
          <div className="mt-3">
            <button
              type="button"
              disabled={readOnly}
              onClick={readOnly ? noop : () => {
                patchData(
                  { consentAccepted: true, consentAt: new Date().toISOString() },
                  "Patient consent confirmed",
                );
                toast.success("Patient consent confirmed!");
              }}
              className={
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] " +
                (readOnly
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-muted cursor-pointer")
              }
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Confirm patient consent
            </button>
          </div>
        )}
      </Card>

      {/* Clinical checklist — submit is noop when readOnly */}
      <div className={`rounded-lg ${checklistEmphasis}`}>
        <Card
          title={`Clinical checklist · ${checklistSchema.title}`}
          action={<ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
        >
          <RuntimeBoundary label="Clinical checklist">
            <SchemaForm
              schema={checklistSchema}
              submitLabel="Save checklist"
              readonly={readOnly}
              onSubmit={readOnly ? noop : (values) => {
                patchData(
                  { ...values, checklistComplete: true, checklistAt: new Date().toISOString() },
                  `Clinical checklist submitted (${checklistSchema.key})`,
                );
                toast.success("Checklist saved successfully!");
              }}
            />

          </RuntimeBoundary>
        </Card>
      </div>

      {/* Visit documentation — submit is noop when readOnly */}
      <div className={`rounded-lg ${documentationEmphasis}`}>
        <Card
          title="Visit documentation"
          action={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        >
          <RuntimeBoundary label="Visit documentation">
            <SchemaForm
              schema={documentationSchema}
              submitLabel="Submit documentation"
              readonly={readOnly}
              onSubmit={readOnly ? noop : (values) => {
                patchData(
                  { ...values, documentationComplete: true, documentationAt: new Date().toISOString() },
                  "Visit documentation submitted",
                );
                toast.success("Documentation submitted successfully!");
              }}
            />

          </RuntimeBoundary>
        </Card>
      </div>

      <OperationalHistoryPanel workflow="booking" entityId={rec.id} title="Visit history" />
    </div>
  );
}

function ReadinessFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={"flex items-center gap-1.5 rounded-md border px-2 py-1.5 "
      + (ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
        : "border-border bg-muted/30 text-muted-foreground")}>
      <CheckCircle2 className="h-3.5 w-3.5" /> {label}{ok ? " · ready" : " · pending"}
    </div>
  );
}

// ---------------------------------------------------------------- Worker task
export function WorkerTaskPanel({ visitId, compact = false }: { visitId: string; compact?: boolean }) {
  const rec = useEntity("booking", visitId);
  if (!rec) return null;
  const state = bindStatus("booking", rec.state);
  const v: any = rec.data;
  return (
    <div className={compact ? "p-3 rounded border border-border" : "p-4 rounded-lg border border-border"}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">#{rec.id} · {bookingPatientName(rec) ?? "—"}</div>
          <div className="text-[12px] text-muted-foreground truncate">{v.service ?? "—"} · {v.area ?? "—"}</div>
        </div>
        <StatusBadge workflow="booking" state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Consent flow
export function ConsentFlowPanel({
  patientName, children,
}: { patientName?: string; children?: React.ReactNode }) {
  return (
    <Card title={patientName ? `Consents · ${patientName}` : "Consents"}
      action={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />}>
      {children ?? <EmptyState title="No consents on file" />}
    </Card>
  );
}

// ---------------------------------------------------------------- Package progress
export function PackageProgressPanel({ packageId, title }: { packageId: string; title?: string }) {
  const rec = useEntity("package", packageId);
  if (!rec) {
    return <Card title={title ?? "Package"} action={<PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />}>
      <EmptyState title="Package not tracked" description="Package will appear once activated by ops." />
    </Card>;
  }
  const state = bindStatus("package", rec.state);
  const nextOptions = nextStates("package", state);
  return (
    <Card title={title ?? `Package ${rec.id}`}
      action={<PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge workflow="package" state={state} />
        <span className="text-[12px] text-muted-foreground">
          {nextOptions.length ? `Next: ${nextOptions.join(", ")}` : "Terminal state"}
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Escalation actions
export function EscalationActionPanel({
  workflow, entityId,
}: { workflow: WorkflowKey; entityId: string }) {
  const rec = useEntity(workflow, entityId);
  const { user } = useAuth();
  const transition = useTransition();
  const role = user?.role ?? null;
  const actor = user?.email ?? "ops@nurseconnect.in";
  const state = useMemo(() => (rec ? bindStatus(workflow, rec.state) : ""), [rec, workflow]);
  if (!rec) return null;
  const allowed = actionsForState(workflow, state).filter(a => can(role, a));
  if (allowed.length === 0) return null;
  return (
    <Card title="Escalation actions">
      <div className="flex flex-wrap gap-2">
        {allowed.map(a => (
          <WorkflowActionButton key={a} action={a} variant="secondary"
            onClick={() => transition({
              workflow, entityId, action: a, role, actor,
              to: ACTION_TO_STATE[a] ?? (nextStates(workflow, state)[0] ?? state),
            })}>
            {labelFor(a)}
          </WorkflowActionButton>
        ))}
      </div>
    </Card>
  );
}