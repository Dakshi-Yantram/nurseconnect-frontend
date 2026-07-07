import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SLAIndicator } from "@/components/shared/SLAIndicator";
import { bindStatus, parseEnteredAt } from "@/lib/workflow-bind";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { OperationalTimeline } from "@/components/shared/OperationalTimeline";
import { useEntities, useEntity, useOrchestration, useTransition } from "@/lib/orchestration";
import { useAuth } from "@/lib/auth-context";
import { Lock, Unlock } from "lucide-react";

export const Route = createFileRoute("/_app/disputes")({ component: DisputesPage });
type ModalType = "hold" | "split" | "refund" | null;

function DisputesPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const rows = useEntities("dispute");
  const [viewId, setViewId] = useState<string | null>(null);
  const view = useEntity("dispute", viewId);
  const [modal, setModal] = useState<ModalType>(null);
  const [notes, setNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const transition = useTransition();
  const store = useOrchestration();
  const close = () => setModal(null);
  const actor = user?.email ?? "finance@nurseconnect.in";
  const role  = user?.role ?? null;
  const d = view?.data as any;
  const amt = d ? parseInt(String(d.amount).replace(/[^\d]/g, ""), 10) || 0 : 0;

  const toggleHold = () => {
    if (!view) return;
    const next = !d.hold;
    store.repos.dispute.upsert({ ...view, data: { ...view.data, hold: next } });
    store.annotate("dispute", view.id, actor, role, next ? "Funds held" : "Funds released");
    setNotes(""); close();
  };
  const submitSplit  = () => { if (!view) return; const r = transition({ workflow: "dispute", entityId: view.id, to: "investigating", actor, role, notes, patch: { split: true } }, { successMessage: "Split resolution saved" }); if (r.ok) { setNotes(""); close(); } };
  const submitRefund = () => { if (!view) return; const r = transition({ workflow: "dispute", entityId: view.id, to: "resolved", actor, role, notes: notes || `Refund ₹${refundAmount || Math.round(amt * 0.85).toLocaleString()}`, patch: { refund: refundAmount || Math.round(amt * 0.85) } }, { successMessage: "Refund issued" }); if (r.ok) { setNotes(""); setRefundAmount(""); close(); } };

  return (
    <div className="space-y-6">
      <Card title="Financial Disputes" padded={false}>
        <table className="w-full text-[13px]"><thead><tr className="bg-muted/40 text-muted-foreground text-left"><th className="px-5 py-2.5">ID</th><th className="px-5 py-2.5">Booking</th><th className="px-5 py-2.5">Amount</th><th className="px-5 py-2.5">Reason</th><th className="px-5 py-2.5">Raised By</th><th className="px-5 py-2.5">Hold</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Opened</th><th className="px-5 py-2.5"></th></tr></thead><tbody>{rows.map(r => { const x = r.data as any; const state = bindStatus("dispute", r.state); return (
          <tr key={r.id} className="border-t border-border hover:bg-muted/30"><td className="px-5 py-3 font-mono text-[12px]">{r.id}</td><td className="px-5 py-3 font-mono text-[12px]">#{x.booking}</td><td className="px-5 py-3 font-semibold">{x.amount}</td><td className="px-5 py-3">{x.reason}</td><td className="px-5 py-3">{x.raisedBy}</td><td className="px-5 py-3">{x.hold ? <StatusChip tone="warning" label={<><Lock className="h-3 w-3 inline" /> Held</>} /> : <StatusChip tone="success" label={<><Unlock className="h-3 w-3 inline" /> Released</>} />}</td><td className="px-5 py-3 flex items-center gap-2"><StatusBadge workflow="dispute" state={state} /><SLAIndicator workflow="dispute" state={state} enteredAt={parseEnteredAt(r.enteredAt)} /></td><td className="px-5 py-3 text-muted-foreground">{x.opened}</td><td className="px-5 py-3"><button onClick={() => setViewId(r.id)} className="text-[12px] text-primary">Review</button></td></tr>
        ); })}</tbody></table>
      </Card>
      {view && d && (
        <Card title={`Dispute Workspace · ${view.id}`} action={<button onClick={() => nav({ to: "/disputes/$disputeId", params: { disputeId: view.id } })} className="text-[12px] text-primary">Open detail page</button>}>
          <div className="grid grid-cols-3 gap-3 text-[13px]"><Info l="Amount" v={d.amount} /><Info l="Reason" v={d.reason} /><Info l="Raised By" v={d.raisedBy} /></div>
          <div className="mt-4 grid grid-cols-3 gap-2">{["Check-in GPS log", "Visit summary", "Patient signature"].map(e => <button key={e} onClick={() => store.annotate("dispute", view.id, actor, role, `Evidence reviewed: ${e}`)} className="p-3 rounded border border-border text-[12px] text-left hover:bg-muted/40">{e}<div className="text-[10.5px] text-muted-foreground mt-0.5">PDF · preview</div></button>)}</div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setModal("hold")} className="px-4 py-2 text-[13px] rounded-md border border-border">{d.hold ? "Release Funds" : "Hold Funds"}</button>
            <button onClick={() => setModal("split")} className="px-4 py-2 text-[13px] rounded-md border border-amber-200 text-amber-700">Split Resolution</button>
            <button onClick={() => setModal("refund")} className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white">Refund Customer</button>
          </div>
          <div className="mt-5"><OperationalTimeline workflow="dispute" entityId={view.id} /></div>
        </Card>
      )}
      <WorkflowModal open={modal === "hold"} onClose={close} title={d?.hold ? "Release Held Funds" : "Place Funds on Hold"} submitLabel="Save Fund Decision" onSubmit={toggleHold} disabled={notes.trim().length < 8}><div className="space-y-3"><FormField label="Decision Reason"><select className={inputCls}><option>Evidence sufficient</option><option>Evidence incomplete</option><option>Customer protection hold</option></select></FormField><FormField label="Finance Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "split"} onClose={close} title="Apply Split Resolution" submitLabel="Apply Split" submitTone="warning" onSubmit={submitSplit} disabled={notes.trim().length < 8}><div className="space-y-3"><FormField label="Customer Share"><input className={inputCls} defaultValue={`₹${Math.round(amt * 0.5).toLocaleString()}`} /></FormField><FormField label="Nurse Share"><input className={inputCls} defaultValue={`₹${Math.round(amt * 0.5).toLocaleString()}`} /></FormField><FormField label="Resolution Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "refund"} onClose={close} title="Approve Customer Refund" submitLabel="Issue Refund" submitTone="success" onSubmit={submitRefund} disabled={notes.trim().length < 8}><div className="space-y-3"><FormField label="Refund Amount"><input value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className={inputCls} placeholder={`Suggested ₹${Math.round(amt * 0.85).toLocaleString()}`} /></FormField><FormField label="Refund Reason"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField><div className="p-3 rounded-md bg-muted/40 text-[12px] text-muted-foreground">Ledger impact preview will be recorded before payout reversal.</div></div></WorkflowModal>
    </div>
  );
}
function Info({ l, v }: { l: string; v: any }) { return <div><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5">{String(v)}</div></div>; }
