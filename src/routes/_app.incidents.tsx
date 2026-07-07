import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { OperationalTimeline } from "@/components/shared/OperationalTimeline";
import { useEntities, useEntity, useOrchestration, useTransition } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/incidents")({ component: IncidentsPage });

const TABS = ["Open", "In Progress", "Resolved"] as const;
type Tab = typeof TABS[number];
type ModalType = "comment" | "escalate" | "resolve" | null;

function IncidentsPage() {
  const nav = useNavigate();
  const router = useRouter();
  const { user } = useAuth();
  const all = useEntities("incident");
  const [tab, setTab] = useState<Tab>("Open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useEntity("incident", selectedId);
  const [modal, setModal] = useState<ModalType>(null);
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState("");
  const transition = useTransition();
  const store = useOrchestration();
  const actor = user?.email ?? "ops@nurseconnect.in";
  const role  = user?.role ?? null;

  const tabMap: Record<Tab, string> = { "Open": "open", "In Progress": "investigating", "Resolved": "resolved" };
  const filtered = all.filter(i => bindStatus("incident", i.state) === tabMap[tab]);
  const openWorkflow = (id: string, m: ModalType) => { setSelectedId(id); setModal(m); setNotes(""); setResolution(""); };
  const close = () => setModal(null);
  const saveComment = () => { if (!selected) return; store.annotate("incident", selected.id, actor, role, notes); close(); };
  const escalate    = () => { if (!selected) return; const r = transition({ workflow: "incident", entityId: selected.id, to: "escalated", actor, role, notes }, { successMessage: "Incident escalated with audit trail" }); if (r.ok) close(); };
  const resolve     = () => { if (!selected) return; const r = transition({ workflow: "incident", entityId: selected.id, to: "resolved", actor, role, notes: resolution, patch: { satisfaction: "Pending survey" } }, { successMessage: "Incident resolved" }); if (r.ok) close(); };

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Open" value={all.filter(i => bindStatus("incident", i.state) === "open").length} tone="danger" />
        <Stat label="In Progress" value={all.filter(i => bindStatus("incident", i.state) === "investigating").length} tone="warning" />
        <Stat label="Resolved (7d)" value={all.filter(i => bindStatus("incident", i.state) === "resolved").length + 14} tone="success" />
        <Stat label="Avg. Resolution" value="6h 22m" tone="info" />
      </div>
      <Card padded={false}>
        <div className="flex border-b border-border">{TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-[13px] font-medium border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>)}</div>
        <ul className="divide-y divide-border">{filtered.map(r => { const i = r.data as any; const state = bindStatus("incident", r.state); return (
          <li key={r.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="font-mono text-[12px] text-muted-foreground">{r.id}</span><SeverityBadge severity={i.severity as any} /><StatusBadge workflow="incident" state={state} /><SLAIndicator workflow="incident" state={state} enteredAt={parseEnteredAt(r.enteredAt)} /></div>
              <div className="text-[14px] font-semibold mt-1">{i.title}</div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">Reporter: {i.reporter} · Assigned: {i.assigned} · Created {i.created}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => nav({ to: "/incidents/$incidentId", params: { incidentId: r.id } })} className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary">Details</button>
              <button onClick={() => openWorkflow(r.id, "comment")} className="px-3 py-1.5 text-[12px] rounded-md border border-border hover:bg-secondary">Comment</button>
              <button onClick={() => openWorkflow(r.id, "escalate")} className="px-3 py-1.5 text-[12px] rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50">Escalate</button>
              {state !== "resolved" && <button onClick={() => openWorkflow(r.id, "resolve")} className="px-3 py-1.5 text-[12px] rounded-md bg-emerald-600 text-white">Resolve</button>}
            </div>
          </li>
        ); })}</ul>
      </Card>
      {selected && <Card title={`Selected Incident Activity · ${selected.id}`}><OperationalTimeline workflow="incident" entityId={selected.id} /></Card>}

      <WorkflowModal open={modal === "comment"} onClose={close} title="Add Internal Comment" submitLabel="Post Comment" onSubmit={saveComment} disabled={notes.trim().length < 5}><div className="space-y-3"><FormField label="Comment Type"><select className={inputCls}><option>Operational update</option><option>Clinical note</option><option>Compliance note</option></select></FormField><FormField label="Visibility"><select className={inputCls}><option>Internal only</option><option>Shared with care team</option></select></FormField><FormField label="Comment"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} placeholder="Internal note (not visible to consumer)…" /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Incident" submitLabel="Submit Escalation" submitTone="warning" onSubmit={escalate} disabled={notes.trim().length < 8}><div className="space-y-3"><FormField label="Escalate To"><select className={inputCls}><option>Clinical Director</option><option>Legal Team</option><option>Regional Head</option></select></FormField><FormField label="Severity"><select className={inputCls}><option>High</option><option>Critical</option><option>Medium</option></select></FormField><FormField label="Reason"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} placeholder="Reason for escalation…" /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "resolve"} onClose={close} title="Resolve Incident" submitLabel="Confirm Resolution" submitTone="success" onSubmit={resolve} disabled={resolution.trim().length < 10}><div className="space-y-3"><FormField label="Resolution Summary"><textarea value={resolution} onChange={e => setResolution(e.target.value)} className={textareaCls} /></FormField><FormField label="Customer Satisfaction"><select className={inputCls}><option>Survey pending</option><option>Excellent</option><option>Good</option><option>Neutral</option><option>Poor</option></select></FormField><FormField label="Preventive Action"><select className={inputCls}><option>ETA alert rule updated</option><option>Nurse coaching assigned</option><option>Compliance follow-up</option></select></FormField></div></WorkflowModal>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: any; tone: any }) { return <div className="nc-card p-5"><div className="text-[12px] text-muted-foreground">{label}</div><div className="text-[24px] font-semibold mt-1">{value}</div><StatusChip tone={tone} label="active" className="mt-2" /></div>; }