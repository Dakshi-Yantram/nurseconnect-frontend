import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Timeline } from "@/components/shared/Timeline";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { DetailShell, ActionBtn } from "@/components/shared/DetailShell";
import { DISPUTES } from "@/lib/mock-data";
import { Lock, Unlock, Split, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { makeActivity, type ActivityEntry } from "@/lib/workflow-state";

export const Route = createFileRoute("/_app/disputes/$disputeId")({ component: DisputeDetail });

function DisputeDetail() {
  const { disputeId } = useParams({ from: "/_app/disputes/$disputeId" });
  const nav = useNavigate();
  const d = DISPUTES.find(x => x.id === disputeId) ?? DISPUTES[0];
  const [workflow, setWorkflow] = useState<"hold" | "split" | "refund" | "evidence" | null>(null);
  const [notes, setNotes] = useState("");
  const [timeline, setTimeline] = useState<ActivityEntry[]>([
    { ts: "Now", title: "Pending Ops review", actor: "finance@nurseconnect.in", type: "review", tone: "warning" },
    { ts: d.opened, title: "Dispute filed by patient", meta: d.raisedBy, actor: d.raisedBy, type: "created", tone: "danger" },
    { ts: "Auto", title: "Funds placed on hold", actor: "system", type: "hold", tone: "muted" },
  ]);
  const close = () => setWorkflow(null);
  const complete = (type: string, title: string, tone: "primary"|"success"|"warning"|"danger"|"muted" = "primary", goBack = false) => {
    setTimeline(t => [makeActivity(type, title, notes, "finance@nurseconnect.in", tone), ...t]);
    setNotes(""); close(); toast.success(`${title} saved`); if (goBack) nav({ to: "/disputes" });
  };

  const amt = parseInt(d.amount.replace(/[^\d]/g, ""), 10) || 0;
  const refund = Math.round(amt * 0.85);
  const split = Math.round(amt * 0.5);

  return (
    <DetailShell
      backTo="/disputes" backLabel="Back to Disputes"
      eyebrow={`Dispute · ${d.id}`} title={d.reason} status={d.status}
      badges={d.hold ? <StatusChip tone="warning" label={<><Lock className="h-3 w-3 inline" /> Funds Held</>} /> : <StatusChip tone="success" label={<><Unlock className="h-3 w-3 inline" /> Released</>} />}
      subtitle={<>Booking #{d.booking} · Raised by {d.raisedBy} · Opened {d.opened}</>}
      actions={<>
        <ActionBtn onClick={() => setWorkflow("hold")}>{d.hold ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />} {d.hold ? "Release" : "Hold"}</ActionBtn>
        <ActionBtn tone="warning" onClick={() => setWorkflow("split")}><Split className="h-4 w-4" /> Split Resolution</ActionBtn>
        <ActionBtn tone="success" onClick={() => setWorkflow("refund")}><RotateCcw className="h-4 w-4" /> Refund Customer</ActionBtn>
      </>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Refund Calculator" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <CalcCell l="Disputed Amount" v={`₹${amt.toLocaleString()}`} />
            <CalcCell l="Platform Fee" v={`₹${Math.round(amt * 0.15).toLocaleString()}`} />
            <CalcCell l="Refund Suggested" v={`₹${refund.toLocaleString()}`} highlight />
            <CalcCell l="Split — Customer" v={`₹${split.toLocaleString()}`} />
            <CalcCell l="Split — Nurse" v={`₹${(amt - split).toLocaleString()}`} />
            <CalcCell l="Hold Status" v={d.hold ? "Active" : "Released"} />
          </div>
        </Card>

        <Card title="Ledger Impact">
          <ul className="space-y-2 text-[12px]">
            <li className="p-2.5 rounded border border-border flex justify-between"><span className="text-muted-foreground">refund_pool → patient_wallet</span><span className="font-medium">₹{refund.toLocaleString()}</span></li>
            <li className="p-2.5 rounded border border-border flex justify-between"><span className="text-muted-foreground">worker_ledger reversal</span><span className="font-medium">-₹{Math.round(amt*0.7).toLocaleString()}</span></li>
            <li className="p-2.5 rounded border border-border flex justify-between"><span className="text-muted-foreground">platform_revenue adj.</span><span className="font-medium">-₹{Math.round(amt*0.15).toLocaleString()}</span></li>
          </ul>
        </Card>
      </div>

      <Card title="Evidence">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["Check-in GPS log", "Visit summary", "Patient signature", "Nurse statement", "Family chat log", "Call recording"].map(e => (
            <div key={e} className="p-3 rounded border border-border text-[12.5px]">
              <div className="font-medium">{e}</div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5">PDF · 0.6MB</div>
              <button onClick={() => { setNotes(`Reviewed evidence: ${e}`); setWorkflow("evidence"); }} className="mt-2 text-[11.5px] text-primary">Review Evidence</button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Resolution Timeline">
        <Timeline items={timeline} />
      </Card>


      <WorkflowModal open={workflow === "hold"} onClose={close} title={d.hold ? "Release Held Funds" : "Place Funds on Hold"} submitLabel="Save Fund Decision" onSubmit={() => complete("fund_hold_changed", d.hold ? "Funds released" : "Funds held", "warning")} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Decision Reason"><select className={inputCls}><option>Evidence sufficient</option><option>Customer protection hold</option><option>Finance risk review</option></select></FormField><FormField label="Finance Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>
      <WorkflowModal open={workflow === "split"} onClose={close} title="Split Resolution" submitLabel="Apply Split" submitTone="warning" onSubmit={() => complete("split_resolution", "Split resolution applied", "warning")} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Customer Share"><input className={inputCls} defaultValue={`₹${split.toLocaleString()}`} /></FormField><FormField label="Nurse Share"><input className={inputCls} defaultValue={`₹${(amt - split).toLocaleString()}`} /></FormField><FormField label="Resolution Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>
      <WorkflowModal open={workflow === "refund"} onClose={close} title="Refund Customer" submitLabel="Issue Refund" submitTone="success" onSubmit={() => complete("refund_completed", "Refund issued to customer", "success", true)} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><FormField label="Refund Amount"><input className={inputCls} defaultValue={`₹${refund.toLocaleString()}`} /></FormField><FormField label="Refund Reason"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>
      <WorkflowModal open={workflow === "evidence"} onClose={close} title="Evidence Review" submitLabel="Record Evidence Review" onSubmit={() => complete("evidence_reviewed", "Evidence reviewed", "muted")} disabled={notes.trim().length < 8}>
        <div className="space-y-3"><div className="h-40 rounded-md border border-border bg-muted/30 grid place-items-center text-[13px] text-muted-foreground">Evidence preview</div><FormField label="Evidence Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div>
      </WorkflowModal>
    </DetailShell>
  );
}

function CalcCell({ l, v, highlight }: { l: string; v: string; highlight?: boolean }) {
  return <div className={`p-3 rounded border ${highlight ? "border-primary/40 bg-blue-50/40" : "border-border"}`}>
    <div className="text-[10.5px] text-muted-foreground">{l}</div>
    <div className={`font-semibold mt-0.5 ${highlight ? "text-primary text-[15px]" : ""}`}>{v}</div>
  </div>;
}
