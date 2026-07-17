import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip, statusToneFor } from "@/components/shared/StatusChip";
import { WorkflowModal, FormField, textareaCls } from "@/components/shared/WorkflowModals";
import { ChevronRight, Clock, UserCheck, RotateCcw, MessageSquarePlus, FilePlus2, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_app/onboarding-review")({ component: OnboardingPage });

// Visual-only 12-step journey. The backend only tracks 5 real statuses;
// each status maps to the closest matching visual stage below.
const STAGES = [
  "Application Received", "Initial Screening", "Documents Pending", "Document Review",
  "Reference Verification", "Background Verification", "Clinical Review",
  "Insurance Eligibility", "Final Approval", "Activated", "Rejected", "Escalated",
];

function stageIndexForStatus(status: string): number {
  switch (status) {
    case "PENDING_REVIEW": return 1;   // Initial Screening
    case "IN_REVIEW": return 3;        // Document Review
    case "NEEDS_CLARIFICATION": return 2; // Documents Pending
    case "APPROVED": return 9;         // Activated
    case "REJECTED": return 10;        // Rejected
    case "CLOSED":
    case "CANCELLED": return 9;
    default: return 0;
  }
}

type Ticket = {
  id: string;
  nurse_id: string;
  nurse_name: string | null;
  nurse_email: string | null;
  specialty: string | null;
  experience_years: number | null;
  city: string | null;
  ticket_type: string;
  status: string;
  priority: string;
  sla_due_at: string | null;
  created_at: string;
};

type ModalType = "move" | "reject" | "reopen" | "comment" | "request-docs" | "escalate" | null;

function OnboardingPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  const [comment, setComment] = useState("");
  const [requestInstructions, setRequestInstructions] = useState("");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [transitionNote, setTransitionNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows: Ticket[] = await apiFetch("/api/review/my-queue");
      setTickets(rows);
      if (rows.length && !rows.find(r => r.id === selectedId)) {
        setSelectedId(rows[0].id);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load onboarding queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selected = tickets.find(t => t.id === selectedId) ?? tickets[0];
  const close = () => setModal(null);

  async function updateStatus(newStatus: string, note?: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const updated: Ticket = await apiFetch(`/api/review/tickets/${selected.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus, note }),
      });
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ...updated } : t));
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update ticket");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleMove() {
    const nextStatus = selected.status === "PENDING_REVIEW" ? "IN_REVIEW" : "APPROVED";
    const ok = await updateStatus(nextStatus, transitionNote);
    if (ok) { toast.success(`Advanced to ${nextStatus.replace("_", " ")}`); setTransitionNote(""); close(); }
  }
  async function handleReject() {
    const ok = await updateStatus("REJECTED", rejectNotes);
    if (ok) { toast.error("Application rejected"); setRejectNotes(""); close(); }
  }
  async function handleRequestDocs() {
    const ok = await updateStatus("NEEDS_CLARIFICATION", requestInstructions);
    if (ok) { toast.success("Marked as needing clarification"); setRequestInstructions(""); close(); }
  }
  async function handleReopen() {
    const ok = await updateStatus("IN_REVIEW", "Re-opened for additional review");
    if (ok) { toast.success("Stage re-opened"); close(); }
  }
  function handleComment() {
    // No backend endpoint exists yet for reviewer notes/comments — this stays
    // local-only for now (not persisted). Flag to the team if you need this saved.
    toast.info("Comment noted (not yet saved to backend — no notes API exists)");
    setComment("");
    close();
  }
  function handleEscalate() {
    toast.info("Escalation noted (not yet saved to backend — no escalation API exists)");
    setEscalationNotes("");
    close();
  }

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!tickets.length) {
    return <Card><div className="p-8 text-center text-[13px] text-muted-foreground">No applications in your review queue right now.</div></Card>;
  }

  const stageIdx = stageIndexForStatus(selected.status);

  return (
    <div className="grid grid-cols-12 gap-6">
      <Card title="Applications in Pipeline" className="col-span-12 lg:col-span-5" padded={false}>
        <ul className="divide-y divide-border max-h-[640px] overflow-y-auto nc-scroll">
          {tickets.map(t => {
            const idx = stageIndexForStatus(t.status);
            return (
              <li key={t.id} onClick={() => setSelectedId(t.id)} className={`p-4 cursor-pointer ${selected.id === t.id ? "bg-blue-50/60 border-l-2 border-l-primary" : "hover:bg-muted/40"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[13px]">{t.nurse_name ?? "Unnamed applicant"}</div>
                  <span className="text-[11px] text-amber-600 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t.sla_due_at ? new Date(t.sla_due_at).toLocaleDateString("en-IN") : "No SLA"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t.id.slice(0, 8)} · Submitted {new Date(t.created_at).toLocaleDateString("en-IN")}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {STAGES.slice(0, 10).map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= Math.min(idx, 9) ? "bg-primary" : "bg-secondary"}`} />)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Stage: {STAGES[idx]}</span>
                  <StatusChip tone={statusToneFor(t.status)} label={t.status.replace("_", " ")} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="col-span-12 lg:col-span-7 space-y-6">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[16px] font-semibold">{selected.nurse_name ?? "Unnamed applicant"}</div>
              <div className="text-[12px] text-muted-foreground">
                {selected.id.slice(0, 8)} · {selected.specialty ?? "—"} · {selected.experience_years ?? "—"} yrs · {selected.city ?? "—"}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Email: <b className="text-foreground">{selected.nurse_email ?? "—"}</b></span>
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> SLA: <b className="text-amber-700">{selected.sla_due_at ? new Date(selected.sla_due_at).toLocaleDateString("en-IN") : "—"}</b></span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => setModal("comment")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><MessageSquarePlus className="h-4 w-4" /> Comment</button>
              <button onClick={() => setModal("request-docs")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><FilePlus2 className="h-4 w-4" /> Request Docs</button>
              <button onClick={() => setModal("escalate")} className="px-3 py-2 text-[12.5px] rounded-md border border-amber-200 text-amber-700 inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Escalate</button>
              <button onClick={() => setModal("reopen")} className="px-3 py-2 text-[12.5px] rounded-md border border-border inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Re-open Stage</button>
              {selected.status !== "REJECTED" && (
                <button onClick={() => setModal("reject")} className="px-3 py-2 text-[12.5px] rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50">Reject Application</button>
              )}
              {selected.status !== "APPROVED" && selected.status !== "REJECTED" && (
                <button onClick={() => setModal("move")} className="px-3 py-2 text-[12.5px] rounded-md bg-primary text-white inline-flex items-center gap-1.5">Move to Next Stage <ChevronRight className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Stage Progression">
          <ol className="grid grid-cols-4 lg:grid-cols-6 gap-2">
            {STAGES.map((s, i) => {
              const done = i < stageIdx;
              const current = i === stageIdx;
              return (
                <li key={s} className="text-center">
                  <div className={`mx-auto h-9 w-9 rounded-full grid place-items-center text-[12px] font-semibold ${done || current ? "bg-primary text-white" : "bg-secondary text-muted-foreground"} ${current ? "ring-2 ring-primary/30" : ""}`}>{i + 1}</div>
                  <div className="text-[10.5px] text-foreground mt-1 leading-tight">{s}</div>
                  <div className="text-[10px] text-muted-foreground">{done ? "✓ Done" : current ? "Active" : "Pending"}</div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <WorkflowModal open={modal === "move"} onClose={close} title="Move to Next Stage" description={`${selected.nurse_name} – ${selected.id.slice(0, 8)}`} submitLabel="Confirm Transition" onSubmit={handleMove} disabled={busy}>
        <p className="text-[13px]">Move status forward from <b>{selected.status.replace("_", " ")}</b>.</p>
        <textarea value={transitionNote} onChange={e => setTransitionNote(e.target.value)} className={`${textareaCls} mt-3`} placeholder="Optional note…" />
      </WorkflowModal>
      <WorkflowModal open={modal === "comment"} onClose={close} title="Internal Comment" submitLabel="Post Comment" onSubmit={handleComment} disabled={comment.trim().length < 5}>
        <FormField label="Comment"><textarea value={comment} onChange={e => setComment(e.target.value)} className={`${textareaCls} mt-3`} placeholder="Internal note…" /></FormField>
      </WorkflowModal>
      <WorkflowModal open={modal === "request-docs"} onClose={close} title="Request Documents" submitLabel="Send Request" submitTone="warning" onSubmit={handleRequestDocs} disabled={requestInstructions.trim().length < 8 || busy}>
        <FormField label="Instructions"><textarea value={requestInstructions} onChange={e => setRequestInstructions(e.target.value)} className={textareaCls} /></FormField>
      </WorkflowModal>
      <WorkflowModal open={modal === "escalate"} onClose={close} title="Escalate Review" submitLabel="Submit Escalation" submitTone="warning" onSubmit={handleEscalate} disabled={escalationNotes.trim().length < 8}>
        <FormField label="Notes"><textarea value={escalationNotes} onChange={e => setEscalationNotes(e.target.value)} className={textareaCls} /></FormField>
      </WorkflowModal>
      <WorkflowModal open={modal === "reject"} onClose={close} title="Reject Application" submitLabel="Confirm Rejection" submitTone="danger" onSubmit={handleReject} disabled={rejectNotes.trim().length < 10 || busy}>
        <FormField label="Reviewer Notes"><textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className={textareaCls} /></FormField>
      </WorkflowModal>
      <WorkflowModal open={modal === "reopen"} onClose={close} title="Re-open Stage" submitLabel="Re-open Stage" submitTone="warning" onSubmit={handleReopen} disabled={busy}>
        <p className="text-[13px]">Re-open for additional review.</p>
      </WorkflowModal>
    </div>
  );
}