import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { Timeline } from "@/components/shared/Timeline";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { COMPLAINTS } from "@/lib/mock-data";
import { ArrowUpRight, CheckCircle2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { makeActivity, type ActivityEntry } from "@/lib/workflow-state";

export const Route = createFileRoute("/_app/complaints/$complaintId")({ component: ComplaintDetail });

function ComplaintDetail() {
  const { complaintId } = useParams({ from: "/_app/complaints/$complaintId" });
  const nav = useNavigate();
  const c = COMPLAINTS.find(x => x.id === complaintId) ?? COMPLAINTS[0];
  const [reply, setReply] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [resolve, setResolve] = useState(false);
  const [notes, setNotes] = useState("");
  const [timeline, setTimeline] = useState<ActivityEntry[]>([
    { ts: "Now", title: "Awaiting nurse response", actor: "support@nurseconnect.in", type: "review", tone: "warning" },
    { ts: "30m ago", title: "Internal note added by Ops", actor: "Ops", type: "note", tone: "muted" },
    { ts: c.created, title: "Complaint raised", meta: c.raisedBy, actor: c.raisedBy, type: "created", tone: "danger" },
  ]);
  const close = () => { setReply(false); setEscalate(false); setResolve(false); };
  const complete = (type: string, title: string, tone: "primary"|"success"|"warning"|"danger"|"muted", goBack = false) => { setTimeline(t => [makeActivity(type, title, notes, "support@nurseconnect.in", tone), ...t]); setNotes(""); close(); toast.success(`${title} saved`); if (goBack) nav({ to: "/complaints" }); };

  return (
    <DetailShell
      backTo="/complaints" backLabel="Back to Complaints"
      eyebrow={`Complaint · ${c.id}`} title={c.subject} status={c.status}
      badges={<>
        <StatusChip tone="info" label={c.category} />
        <StatusChip tone={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "muted"} label={c.severity} />
        <StatusChip tone={c.sla.includes("Resolved") ? "success" : c.sla.includes("2h") ? "danger" : "warning"} label={`SLA: ${c.sla}`} dot />
      </>}
      subtitle={<>Raised by {c.raisedBy} · {c.created}</>}
      actions={<>
        <ActionBtn onClick={() => setReply(true)}><MessageSquarePlus className="h-4 w-4" /> Reply</ActionBtn>
        <ActionBtn tone="warning" onClick={() => setEscalate(true)}><ArrowUpRight className="h-4 w-4" /> Escalate</ActionBtn>
        {c.status !== "resolved" && <ActionBtn tone="success" onClick={() => setResolve(true)}><CheckCircle2 className="h-4 w-4" /> Resolve</ActionBtn>}
      </>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Complaint Details" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <Info l="Category" v={c.category} />
            <Info l="Severity" v={c.severity} />
            <Info l="SLA" v={c.sla} />
            <Info l="Raised By" v={c.raisedBy} />
            <Info l="Created" v={c.created} />
            <Info l="Status" v={c.status.replace("_"," ")} />
          </div>
          <div className="mt-5">
            <h4 className="text-[13px] font-semibold mb-2">Description</h4>
            <p className="text-[12.5px] text-muted-foreground">Patient family reports recurring punctuality issues. Requesting follow-up and corrective action plan.</p>
          </div>
        </Card>

        <Card title="Linked Booking">
          <div className="text-[12.5px] space-y-2">
            <Row l="Booking" v="#B0028" />
            <Row l="Service" v="Geriatric Care" />
            <Row l="Date" v="2026-05-04" />
            <Row l="Visit Outcome" v="Completed late" />
          </div>
        </Card>
      </div>

      <Card title="Conversation Timeline">
        <Timeline items={timeline} />
      </Card>

      <WorkflowModal open={reply} onClose={close} title="Reply to Customer" submitLabel="Send Reply" onSubmit={() => complete("reply_sent", "Customer reply sent", "primary")} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Template"><select className={inputCls}><option>Apology + corrective action</option><option>Information requested</option><option>Resolution update</option></select></FormField><FormField label="Reply"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} placeholder="Reply visible to the customer…" /></FormField></div>
      </WorkflowModal>
      <WorkflowModal open={escalate} onClose={close} title="Escalate Complaint" submitLabel="Submit Escalation" submitTone="warning" onSubmit={() => complete("escalation_triggered", "Complaint escalated", "warning")} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Escalate To"><select className={inputCls}><option>Clinical Lead</option><option>Regional Head</option><option>Compliance Team</option></select></FormField><FormField label="Reason"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>
      <WorkflowModal open={resolve} onClose={close} title="Resolve Complaint" submitLabel="Confirm Resolution" submitTone="success" onSubmit={() => complete("resolution_completed", "Complaint resolved", "success", true)} disabled={notes.trim().length < 10}>
        <div className="space-y-3"><FormField label="Resolution Summary"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField><FormField label="Customer Notification"><select className={inputCls}><option>Send resolution summary</option><option>Send and request satisfaction survey</option></select></FormField></div>
      </WorkflowModal>
    </DetailShell>
  );
}
function Info({ l, v }: { l: string; v: any }) { return <div><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5 capitalize">{v}</div></div>; }
function Row({ l, v }: { l: string; v: string }) { return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>; }
