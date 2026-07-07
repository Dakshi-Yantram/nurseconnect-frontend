import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { INCIDENTS } from "@/lib/mock-data";
import { MessageSquarePlus, ArrowUpRight, CheckCircle2, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { makeActivity, type ActivityEntry } from "@/lib/workflow-state";

export const Route = createFileRoute("/_app/incidents/$incidentId")({ component: IncidentDetail });

function IncidentDetail() {
  const { incidentId } = useParams({ from: "/_app/incidents/$incidentId" });
  const nav = useNavigate();
  const i = INCIDENTS.find(x => x.id === incidentId) ?? INCIDENTS[0];
  const [comment, setComment] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [resolve, setResolve] = useState(false);
  const [note, setNote] = useState("");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [timeline, setTimeline] = useState<ActivityEntry[]>([
    { ts: "Now", title: "Awaiting nurse statement", meta: "Compliance", actor: "Compliance", type: "review", tone: "warning" },
    { ts: "1h ago", title: "Reassigned nurse and informed family", meta: "Ops Team", actor: "Ops Team", type: "assignment", tone: "primary" },
    { ts: "2h ago", title: "Family raised concern via app", meta: "Reporter", actor: "Family", type: "created", tone: "muted" },
  ]);
  const [comments, setComments] = useState<ActivityEntry[]>([
    { ts: "1h ago", title: "Reassigned nurse and informed family.", actor: "Ops Team", type: "note", tone: "primary" },
    { ts: "30m ago", title: "Awaiting nurse statement.", actor: "Compliance", type: "note", tone: "warning" },
  ]);
  const saveComment = () => { const entry = makeActivity("note_added", "Internal comment posted", note, "ops@nurseconnect.in", "primary"); setTimeline(t => [entry, ...t]); setComments(c => [entry, ...c]); setNote(""); setComment(false); toast.success("Comment saved to incident history"); };
  const submitEscalation = () => { const entry = makeActivity("escalation_triggered", "Incident escalated", escalationNotes, "ops@nurseconnect.in", "warning"); setTimeline(t => [entry, ...t]); setEscalationNotes(""); setEscalate(false); toast.warning("Incident escalated with audit trail"); };
  const submitResolution = () => { const entry = makeActivity("resolution_completed", "Incident resolved", resolutionNotes, "ops@nurseconnect.in", "success"); setTimeline(t => [entry, ...t]); setResolutionNotes(""); setResolve(false); toast.success("Incident resolved after confirmation"); };

  return (
    <DetailShell
      backTo="/incidents" backLabel="Back to Incidents"
      eyebrow={`Incident · ${i.id}`}
      title={i.title}
      status={i.status}
      badges={<StatusChip tone={i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "muted"} label={i.severity.toUpperCase()} />}
      subtitle={<>Reporter: {i.reporter} · Assigned: {i.assigned} · Created {i.created}</>}
      actions={<>
        <ActionBtn onClick={() => setComment(true)}><MessageSquarePlus className="h-4 w-4" /> Comment</ActionBtn>
        <ActionBtn tone="warning" onClick={() => setEscalate(true)}><ArrowUpRight className="h-4 w-4" /> Escalate</ActionBtn>
        {i.status !== "resolved" && <ActionBtn tone="success" onClick={() => setResolve(true)}><CheckCircle2 className="h-4 w-4" /> Resolve</ActionBtn>}
      </>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Overview" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-4 text-[12.5px]">
            <Info l="Severity" v={i.severity.toUpperCase()} />
            <Info l="Status" v={i.status.replace("_"," ")} />
            <Info l="Reporter" v={i.reporter} />
            <Info l="Assigned Team" v={i.assigned} />
            <Info l="Created" v={i.created} />
            <Info l="Customer Satisfaction" v={i.satisfaction} />
          </div>
          <div className="mt-5">
            <h4 className="text-[13px] font-semibold mb-2">Root Cause Analysis</h4>
            <p className="text-[12.5px] text-muted-foreground">Operational delay caused by traffic and last-minute reassignment. Mitigation: proactive ETA alerts, secondary nurse on standby for high-priority visits.</p>
          </div>
          <div className="mt-5">
            <h4 className="text-[13px] font-semibold mb-2">Linked Entities</h4>
            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <button onClick={() => nav({ to: "/patients/$patientId", params: { patientId: "PAT-1005" } })} className="p-3 rounded border border-border text-left hover:bg-muted/40">
                <div className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1"><User className="h-3 w-3" /> Patient</div>
                <div className="font-medium mt-0.5">PAT-1005 · Meera Joshi</div>
              </button>
              <button onClick={() => nav({ to: "/nurses/$nurseId", params: { nurseId: "NUR-2001" } })} className="p-3 rounded border border-border text-left hover:bg-muted/40">
                <div className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1"><User className="h-3 w-3" /> Nurse</div>
                <div className="font-medium mt-0.5">NUR-2001 · Priya Sharma</div>
              </button>
            </div>
          </div>
        </Card>

        <Card title="SLA Timer">
          <div className="text-center py-3">
            <Clock className="h-7 w-7 text-amber-600 mx-auto" />
            <div className="text-[24px] font-semibold mt-2">04:12:38</div>
            <div className="text-[11.5px] text-muted-foreground">remaining to first response</div>
          </div>
          <div className="mt-3 space-y-2 text-[12px]">
            <Row l="Acknowledged" v="2h ago" />
            <Row l="First Update" v="1h ago" />
            <Row l="Target Resolution" v="6h" />
          </div>
        </Card>
      </div>

      <Card title="Resolution Timeline">
        <Timeline items={timeline} />
      </Card>

      <Card title="Internal Comments">
        <ul className="space-y-2">
          {comments.map((c, idx) => <li key={idx} className="p-3 bg-muted/40 rounded text-[12.5px]"><b>{c.actor}</b> · {c.ts} — {c.notes ?? c.title}</li>)}
        </ul>
      </Card>

      <WorkflowModal open={comment} onClose={() => setComment(false)} title="Add Internal Comment" submitLabel="Post Comment" onSubmit={saveComment} disabled={note.trim().length < 5}>
        <div className="space-y-3"><FormField label="Comment Type"><select className={inputCls}><option>Operational update</option><option>Clinical note</option><option>Compliance note</option></select></FormField><FormField label="Comment"><textarea value={note} onChange={e => setNote(e.target.value)} className={textareaCls} placeholder="Internal note (not visible to consumer)…" /></FormField></div>
      </WorkflowModal>

      <WorkflowModal open={escalate} onClose={() => setEscalate(false)} title="Escalate Incident" submitLabel="Submit Escalation" submitTone="warning" onSubmit={submitEscalation} disabled={escalationNotes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Escalate To"><select className={inputCls}><option>Clinical Director</option><option>Legal Team</option><option>Regional Head</option></select></FormField><FormField label="Severity"><select className={inputCls}><option>High</option><option>Critical</option><option>Medium</option></select></FormField><FormField label="Reason"><textarea value={escalationNotes} onChange={e => setEscalationNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>

      <WorkflowModal open={resolve} onClose={() => setResolve(false)} title="Resolve Incident" submitLabel="Confirm Resolution" submitTone="success" onSubmit={submitResolution} disabled={resolutionNotes.trim().length < 10}>
        <div className="space-y-3"><FormField label="Resolution Summary"><textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} className={textareaCls} /></FormField><FormField label="Customer Satisfaction"><select className={inputCls}><option>Survey pending</option><option>Excellent</option><option>Good</option><option>Neutral</option><option>Poor</option></select></FormField></div>
      </WorkflowModal>
    </DetailShell>
  );
}

function Info({ l, v }: { l: string; v: any }) { return <div><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5 capitalize">{v}</div></div>; }
function Row({ l, v }: { l: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>; }
