import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { OperationalTimeline } from "@/components/shared/OperationalTimeline";
import { useEntities, useEntity, useTransition } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/complaints")({ component: ComplaintsPage });
type ModalType = "reply" | "escalate" | "resolve" | null;

// Valid transitions per state
const ALLOWED: Record<string, string[]> = {
  open:          ["investigating", "escalated"],
  investigating: ["escalated", "resolved"],
  in_progress:   ["escalated", "resolved"],  // ← ADD THIS
  escalated:     ["resolved"],
  resolved:      [],
};

function canTransition(currentState: string, to: string) {
  return ALLOWED[currentState]?.includes(to) ?? false;
}

function ComplaintsPage() {
  const nav = useNavigate();
  const router = useRouter();
  const { user } = useAuth();
  const rows = useEntities("complaint");
  const [viewId, setViewId] = useState<string | null>(null);
  const view = useEntity("complaint", viewId);
  const [modal, setModal] = useState<ModalType>(null);
  const [notes, setNotes] = useState("");
  const transition = useTransition();
  const close = () => setModal(null);
  const actor = user?.email ?? "ops@nurseconnect.in";
  const role  = user?.role ?? null;

  const run = (to: string, msg: string) => {
    if (!view) return;
    const res = transition({ workflow: "complaint", entityId: view.id, to, actor, role, notes }, { successMessage: msg });
    if (res.ok) { setNotes(""); close(); }
  };

  const currentState = view ? bindStatus("complaint", view.state) : "";

  return (
    <div className="space-y-6">
      <button
        onClick={() => { if (viewId) { setViewId(null); } else { router.history.back(); } }}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card title="Complaint Queue" padded={false}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left">
              <th className="px-5 py-2.5">ID</th><th className="px-5 py-2.5">Subject</th>
              <th className="px-5 py-2.5">Category</th><th className="px-5 py-2.5">Severity</th>
              <th className="px-5 py-2.5">SLA</th><th className="px-5 py-2.5">Raised By</th>
              <th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const c = r.data as any;
              const state = bindStatus("complaint", r.state);
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px]">{r.id}</td>
                  <td className="px-5 py-3 font-medium">{c.subject}</td>
                  <td className="px-5 py-3"><StatusChip tone="info" label={c.category} /></td>
                  <td className="px-5 py-3"><StatusChip tone={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "muted"} label={c.severity} /></td>
                  <td className="px-5 py-3"><SLAIndicator workflow="complaint" state={state} enteredAt={parseEnteredAt(r.enteredAt)} /></td>
                  <td className="px-5 py-3">{c.raisedBy}</td>
                  <td className="px-5 py-3"><StatusBadge workflow="complaint" state={state} /></td>
                  <td className="px-5 py-3"><button onClick={() => setViewId(r.id)} className="text-[12px] text-primary">Review</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {view && (() => {
        const c = view.data as any;
        const canReply    = canTransition(currentState, "investigating");
        const canEscalate = canTransition(currentState, "escalated");
        const canResolve  = canTransition(currentState, "resolved");

        return (
          <Card title={c.subject} action={<button onClick={() => nav({ to: "/complaints/$complaintId", params: { complaintId: view.id } })} className="text-[12px] text-primary">Open detail page</button>}>
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              <Info l="Severity" v={c.severity} /><Info l="Category" v={c.category} /><Info l="SLA" v={c.sla} />
              <Info l="Raised By" v={c.raisedBy} /><Info l="Created" v={c.created} /><Info l="State" v={currentState} />
            </div>

            <div className="mt-3 text-[11.5px] text-muted-foreground">
              {currentState === "open" && "💡 Reply first to move to Investigating, then you can Resolve."}
              {(currentState === "investigating" || currentState === "in_progress") && "💡 You can now Escalate or Resolve this complaint."}
              {currentState === "escalated" && "💡 Complaint is escalated — you can now Resolve."}
              {currentState === "resolved" && "✅ This complaint is resolved."}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setModal("reply")} disabled={!canReply} className="px-4 py-2 text-[13px] rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed">Reply</button>
              <button onClick={() => setModal("escalate")} disabled={!canEscalate} className="px-4 py-2 text-[13px] rounded-md border border-amber-200 text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">Escalate</button>
              <button onClick={() => setModal("resolve")} disabled={!canResolve} className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">Resolve</button>
            </div>
            <div className="mt-5"><OperationalTimeline workflow="complaint" entityId={view.id} /></div>
          </Card>
        );
      })()}

      <WorkflowModal open={modal === "reply"} onClose={close} title="Reply to Customer" submitLabel="Send Reply" onSubmit={() => run("investigating", "Reply sent and conversation updated")} disabled={notes.trim().length < 8}>
        <div className="space-y-3">
          <FormField label="Template"><select className={inputCls}><option>Apology + corrective action</option><option>Information requested</option><option>Resolution update</option></select></FormField>
          <FormField label="Consumer Response"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField>
        </div>
      </WorkflowModal>

      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Complaint" submitLabel="Submit Escalation" submitTone="warning" onSubmit={() => run("escalated", "Complaint escalated with owner assignment")} disabled={notes.trim().length < 8}>
        <div className="space-y-3">
          <FormField label="Escalate To"><select className={inputCls}><option>Clinical Lead</option><option>Regional Head</option><option>Compliance Team</option></select></FormField>
          <FormField label="Reason"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField>
        </div>
      </WorkflowModal>

      <WorkflowModal open={modal === "resolve"} onClose={close} title="Resolve Complaint" submitLabel="Confirm Resolution" submitTone="success" onSubmit={() => run("resolved", "Complaint resolved with audit history")} disabled={notes.trim().length < 10}>
        <div className="space-y-3">
          <FormField label="Resolution Summary"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField>
          <FormField label="Customer Notification"><select className={inputCls}><option>Send resolution summary</option><option>Send and request satisfaction survey</option></select></FormField>
        </div>
      </WorkflowModal>
    </div>
  );
}

function Info({ l, v }: { l: string; v: any }) {
  return <div><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5 capitalize">{String(v)}</div></div>;
}