/**
 * Reusable operational entity components (Phase 3).
 *
 * All cards are workflow-aware (consume the registry via StatusBadge/SLAIndicator),
 * portal-agnostic and role-safe. Pages MUST consume these instead of inlining
 * their own row/card markup.
 */
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/shared/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { WorkflowActionButton } from "@/components/shared/WorkflowActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ActionKey } from "@/lib/actions";
import { actionsForState, type WorkflowKey } from "@/lib/workflows";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import type {
  BookingEntity, ConsentEntity, IncidentEntity, PackageEntity, VisitEntity,
} from "@/lib/domain";
import type { Patient } from "@/lib/mock-data";
import {
  CalendarCheck, MapPin, HeartHandshake, FileSignature, AlertOctagon, Package,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// --------------------------------------------------------------- Generic shells
function EntityRow({
  icon: Icon, title, subtitle, status, sla, severity, actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode; subtitle?: ReactNode;
  status?: ReactNode; sla?: ReactNode; severity?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="h-8 w-8 rounded-md bg-muted grid place-items-center text-muted-foreground shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate">{title}</div>
        {subtitle && <div className="text-[12px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {severity}{status}{sla}{actions}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Booking / Visit
export function BookingSummaryCard({ b, to }: { b: BookingEntity; to?: string }) {
  const state = bindStatus("booking", b.rawStatus);
  return (
    <EntityRow
      icon={CalendarCheck}
      title={<>#{b.id} · {b.service}</>}
      subtitle={<>{b.patientName} · {b.area} · {b.startedAt} · {b.duration}</>}
      status={<StatusBadge workflow="booking" state={state} />}
      sla={<SLAIndicator workflow="booking" state={state} enteredAt={parseEnteredAt(b.startedAt)} />}
      actions={to && <Link to={to as any} className="text-[12px] text-primary">Open</Link>}
    />
  );
}

export function VisitSummaryCard({ v, role = "worker" }: { v: VisitEntity; role?: "worker"|"consumer"|"admin" }) {
  const state = bindStatus("booking", v.rawStatus);
  const allowed = actionsForState("booking", state);
  return (
    <EntityRow
      icon={MapPin}
      title={<>#{v.id} · {v.patientName}</>}
      subtitle={<>{v.service} · {v.area}</>}
      status={<StatusBadge workflow="booking" state={state} />}
      sla={<SLAIndicator workflow="booking" state={state} enteredAt={parseEnteredAt(v.startedAt)} />}
      actions={role === "worker" && <VisitActions allowed={allowed} />}
    />
  );
}

function VisitActions({ allowed }: { allowed: ActionKey[] }) {
  return (
    <div className="flex gap-2">
      {allowed.includes("worker.check_in") && (
        <WorkflowActionButton action="worker.check_in" variant="secondary">Check in</WorkflowActionButton>
      )}
      {allowed.includes("worker.check_out") && (
        <WorkflowActionButton action="worker.check_out" variant="secondary">Check out</WorkflowActionButton>
      )}
      {allowed.includes("worker.escalate_visit") && (
        <WorkflowActionButton action="worker.escalate_visit" variant="danger">Escalate</WorkflowActionButton>
      )}
    </div>
  );
}

// --------------------------------------------------------------- Patient
export function PatientSummaryCard({ p }: { p: Patient }) {
  return (
    <EntityRow
      icon={HeartHandshake}
      title={<>{p.name}</>}
      subtitle={<>{p.id} · {p.age}{p.gender} · {p.plan} · {p.city}</>}
      status={<span className="text-[11px] text-muted-foreground">Last visit {p.lastVisit}</span>}
    />
  );
}

// --------------------------------------------------------------- Consent
export function ConsentStatusCard({ c }: { c: ConsentEntity }) {
  const tone = c.rawStatus === "active" ? "success" : c.rawStatus === "revoked" ? "danger" : "warning";
  return (
    <EntityRow
      icon={FileSignature}
      title={<>{c.type} · {c.version}</>}
      subtitle={<>{c.patientName} · signed {c.signedAt}</>}
      status={<span className={`text-[11px] font-medium capitalize ${
        tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-amber-700"
      }`}>{c.rawStatus}</span>}
    />
  );
}

// --------------------------------------------------------------- Incident
export function IncidentSummaryCard({ i }: { i: IncidentEntity }) {
  const state = bindStatus("incident", i.rawStatus);
  return (
    <EntityRow
      icon={AlertOctagon}
      title={i.title}
      subtitle={<>{i.id} · reporter {i.reporter} · assigned {i.assigned}</>}
      severity={<SeverityBadge severity={i.severity} />}
      status={<StatusBadge workflow="incident" state={state} />}
      sla={<SLAIndicator workflow="incident" state={state} enteredAt={parseEnteredAt(i.createdAt)} />}
    />
  );
}

// --------------------------------------------------------------- Package
export function PackageSummaryCard({ p }: { p: PackageEntity }) {
  const state = bindStatus("package", p.rawStatus);
  return (
    <EntityRow
      icon={Package}
      title={p.name}
      subtitle={p.id}
      status={<StatusBadge workflow="package" state={state} />}
    />
  );
}

// --------------------------------------------------------------- Workflow panels
export function WorkflowStatusPanel({
  workflow, state, enteredAt, title = "Status",
}: { workflow: WorkflowKey; state: string; enteredAt: Date; title?: string }) {
  return (
    <Card title={title}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge workflow={workflow} state={state} />
        <SLAIndicator workflow={workflow} state={state} enteredAt={enteredAt} />
      </div>
    </Card>
  );
}

/**
 * Renders permission-aware action buttons for the current workflow state.
 * Buttons hide automatically when the role/portal cannot perform them.
 */
export function ActionPanel({
  workflow, state, onAction, title = "Actions",
}: {
  workflow: WorkflowKey; state: string;
  onAction?: (action: ActionKey) => void; title?: string;
}) {
  const actions = actionsForState(workflow, state);
  if (actions.length === 0) {
    return <Card title={title}><EmptyState title="No actions available" description="State has no permitted transitions." /></Card>;
  }
  return (
    <Card title={title}>
      <div className="flex flex-wrap gap-2">
        {actions.map(a => (
          <WorkflowActionButton key={a} action={a} variant="secondary" onClick={() => onAction?.(a)}>
            {labelFor(a)}
          </WorkflowActionButton>
        ))}
      </div>
    </Card>
  );
}

function labelFor(a: ActionKey): string {
  return a.split(".")[1].replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

// --------------------------------------------------------------- Operational queue
interface QueueItem { id: string; title: ReactNode; meta?: ReactNode; right?: ReactNode }
export function OperationalQueueCard({
  title, items, emptyTitle = "Queue is empty",
}: { title: string; items: QueueItem[]; emptyTitle?: string }) {
  return (
    <Card title={title} padded={false}>
      {items.length === 0
        ? <div className="p-5"><EmptyState title={emptyTitle} /></div>
        : (
          <ul>
            {items.map(it => (
              <li key={it.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{it.title}</div>
                  {it.meta && <div className="text-[12px] text-muted-foreground truncate">{it.meta}</div>}
                </div>
                {it.right}
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}
