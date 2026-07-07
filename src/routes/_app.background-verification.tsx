import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { StatusChip } from "@/components/shared/StatusChip";
import { Drawer } from "@/components/shared/Drawer";
import { Timeline } from "@/components/shared/Timeline";
import { WorkflowModal, FormField, inputCls, textareaCls } from "@/components/shared/WorkflowModals";
import { ShieldCheck, GraduationCap, ScrollText, AlertOctagon, Briefcase, CreditCard, Eye, CheckCircle2, XCircle, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { makeActivity, type ActivityEntry } from "@/lib/workflow-state";

export const Route = createFileRoute("/_app/background-verification")({ component: BgVerifyPage });

const CATEGORIES = [
  { icon: ShieldCheck, name: "Identity Verification", verified: 142, pending: 12, failed: 2 },
  { icon: GraduationCap, name: "Education Check", verified: 138, pending: 14, failed: 4 },
  { icon: ScrollText, name: "License Verification", verified: 145, pending: 9, failed: 2 },
  { icon: AlertOctagon, name: "Criminal Record Check", verified: 140, pending: 11, failed: 5 },
  { icon: Briefcase, name: "Employment History", verified: 130, pending: 22, failed: 4 },
  { icon: CreditCard, name: "Credit Verification", verified: 122, pending: 28, failed: 6 },
];

type Q = { id: string; nurse: string; checks: string[]; status: string; initiated: string; verifier: string; flags: number; timeline: ActivityEntry[] };
const BASE_QUEUE: Q[] = [
  { id: "BGV-001", nurse: "Karthik Reddy", checks: ["Identity","License"], status: "in_progress", initiated: "2d ago", verifier: "bg-ops@nurseconnect.in", flags: 0, timeline: [] },
  { id: "BGV-002", nurse: "Mohit Bansal", checks: ["Criminal","Employment"], status: "pending_documents", initiated: "1d ago", verifier: "compliance@nurseconnect.in", flags: 2, timeline: [] },
  { id: "BGV-003", nurse: "Priti Menon", checks: ["Education","Reference"], status: "in_progress", initiated: "3h ago", verifier: "bg-ops@nurseconnect.in", flags: 1, timeline: [] },
  { id: "BGV-004", nurse: "Ravi Patel", checks: ["All checks"], status: "completed", initiated: "5d ago", verifier: "regional-verifier@nurseconnect.in", flags: 0, timeline: [] },
  { id: "BGV-005", nurse: "Anita Bhat", checks: ["Criminal"], status: "failed", initiated: "1w ago", verifier: "compliance@nurseconnect.in", flags: 3, timeline: [] },
];

const BASE_SECTIONS = [
  { k: "identity", label: "Identity (Aadhaar/PAN)", status: "verified", evidence: "UIDAI + PAN match", reviewer: "bg-ops@nurseconnect.in" },
  { k: "education", label: "Education credentials", status: "verified", evidence: "Institute registry match", reviewer: "ops@nurseconnect.in" },
  { k: "employment", label: "Past employment", status: "in_progress", evidence: "HR callback pending", reviewer: "regional-verifier@nurseconnect.in" },
  { k: "criminal", label: "Criminal record / police clearance", status: "pending", evidence: "Police portal receipt", reviewer: "compliance@nurseconnect.in" },
  { k: "council", label: "Nursing Council registration", status: "verified", evidence: "Council registry match", reviewer: "compliance@nurseconnect.in" },
];

type ModalType = "note" | "section" | "approve-all" | "reject-all" | "evidence" | null;

function BgVerifyPage() {
  const [queue, setQueue] = useState<Q[]>(() => BASE_QUEUE.map(q => ({ ...q, timeline: [
    { ts: "2026-05-07 10:14", title: "Identity verified via UIDAI", actor: "system", type: "verification_completed", tone: "success" },
    { ts: "2026-05-05 12:05", title: "Employment verification in progress", actor: q.verifier, type: "review_started", tone: "warning" },
    { ts: "2026-05-04 09:20", title: "Verification initiated", actor: "ops@nurseconnect.in", type: "created", tone: "muted" },
  ] })));
  const [viewId, setViewId] = useState<string | null>(null);
  const view = queue.find(q => q.id === viewId) ?? null;
  const [sections, setSections] = useState(BASE_SECTIONS);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedSection, setSelectedSection] = useState<typeof BASE_SECTIONS[number] | null>(null);
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | "reupload">("approved");

  const addActivity = (patch: Partial<Q>, activity: ActivityEntry) => {
    if (!view) return;
    setQueue(prev => prev.map(q => q.id === view.id ? { ...q, ...patch, timeline: [activity, ...q.timeline] } : q));
  };
  const close = () => setModal(null);
  const openSection = (s: typeof BASE_SECTIONS[number]) => { setSelectedSection(s); setNotes(""); setDecision("approved"); setModal("section"); };
  const submitNote = () => { addActivity({}, makeActivity("note_added", "Verifier note added", notes, view?.verifier, "primary")); setNotes(""); close(); toast.success("Verification note saved"); };
  const submitSection = () => {
    if (!selectedSection) return;
    const status = decision === "approved" ? "verified" : decision === "reupload" ? "pending" : "failed";
    setSections(prev => prev.map(s => s.k === selectedSection.k ? { ...s, status, reviewer: view?.verifier ?? s.reviewer } : s));
    addActivity({}, makeActivity("verification_completed", `${selectedSection.label}: ${decision}`, notes, view?.verifier, decision === "approved" ? "success" : "warning"));
    setNotes(""); setSelectedSection(null); close(); toast.success("Verification section updated");
  };
  const approveAll = () => { setSections(prev => prev.map(s => ({ ...s, status: "verified" }))); addActivity({ status: "completed", flags: 0 }, makeActivity("approval_completed", "Background verification approved", notes, view?.verifier, "success")); setNotes(""); close(); toast.success("Background verification approved"); };
  const rejectAll = () => { addActivity({ status: "failed" }, makeActivity("rejection_completed", "Background verification rejected", notes, view?.verifier, "danger")); setNotes(""); close(); toast.error("Background verification rejected with evidence notes"); };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CATEGORIES.map(c => <div key={c.name} className="nc-card p-5"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center"><c.icon className="h-5 w-5" /></div><div className="text-[13px] font-semibold">{c.name}</div></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-[18px] font-semibold text-emerald-600">{c.verified}</div><div className="text-[11px] text-muted-foreground">Verified</div></div><div><div className="text-[18px] font-semibold text-amber-600">{c.pending}</div><div className="text-[11px] text-muted-foreground">Pending</div></div><div><div className="text-[18px] font-semibold text-rose-600">{c.failed}</div><div className="text-[11px] text-muted-foreground">Failed</div></div></div></div>)}
      </div>

      <Card title="Verification Queue" padded={false}>
        <table className="w-full text-[13px]"><thead><tr className="bg-muted/40 text-muted-foreground text-left"><th className="px-5 py-2.5 font-medium">ID</th><th className="px-5 py-2.5 font-medium">Nurse</th><th className="px-5 py-2.5 font-medium">Checks</th><th className="px-5 py-2.5 font-medium">Verifier</th><th className="px-5 py-2.5 font-medium">Flags</th><th className="px-5 py-2.5 font-medium">Status</th><th className="px-5 py-2.5"></th></tr></thead>
          <tbody>{queue.map(q => <tr key={q.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setViewId(q.id)}><td className="px-5 py-3 font-mono text-[12px]">{q.id}</td><td className="px-5 py-3 font-medium">{q.nurse}</td><td className="px-5 py-3"><div className="flex gap-1.5 flex-wrap">{q.checks.map(c => <StatusChip key={c} tone="info" label={c} />)}</div></td><td className="px-5 py-3 text-muted-foreground">{q.verifier}</td><td className="px-5 py-3"><StatusChip tone={q.flags ? "warning" : "success"} label={`${q.flags} flags`} /></td><td className="px-5 py-3"><StatusChip tone={q.status === "completed" ? "success" : q.status === "failed" ? "danger" : "warning"} label={q.status.replace("_"," ")} dot /></td><td className="px-5 py-3"><button className="text-[12px] text-primary inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Review</button></td></tr>)}</tbody>
        </table>
      </Card>

      <Drawer open={!!view} onClose={() => setViewId(null)} title={`Background Check ${view?.id}`} description={view ? `${view.nurse} · Assigned ${view.verifier}` : undefined} width="lg" footer={<><button onClick={() => setModal("note")} className="px-3 py-2 text-[13px] rounded-md border border-border">Add Note</button><button onClick={() => setModal("reject-all")} className="px-3 py-2 text-[13px] rounded-md border border-rose-200 text-rose-700">Reject</button><button onClick={() => setModal("approve-all")} className="px-3 py-2 text-[13px] rounded-md bg-emerald-600 text-white">Approve All</button></>}>
        <div className="space-y-5">
          <Card title="Verification Sections"><ul className="space-y-2">{sections.map(s => <li key={s.k} className="flex items-center justify-between p-2.5 rounded border border-border"><div><div className="text-[13px] font-medium">{s.label}</div><div className="text-[11px] text-muted-foreground">Evidence: {s.evidence} · Reviewer: {s.reviewer}</div></div><div className="flex items-center gap-2"><StatusChip tone={s.status === "verified" ? "success" : s.status === "in_progress" ? "warning" : s.status === "failed" ? "danger" : "muted"} label={s.status.replace("_"," ")} dot /><button onClick={() => openSection(s)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="Review"><FileSearch className="h-4 w-4" /></button><button onClick={() => { setSelectedSection(s); setDecision("approved"); setNotes("Evidence checked and verified."); setModal("section"); }} className="h-7 w-7 grid place-items-center rounded hover:bg-emerald-50 text-emerald-700" title="Approve"><CheckCircle2 className="h-4 w-4" /></button><button onClick={() => { setSelectedSection(s); setDecision("rejected"); setModal("section"); }} className="h-7 w-7 grid place-items-center rounded hover:bg-rose-50 text-rose-700" title="Reject"><XCircle className="h-4 w-4" /></button></div></li>)}</ul></Card>
          <Card title="Manual Review Flags"><div className="space-y-2 text-[12.5px]"><div className="p-3 rounded border border-border flex justify-between"><span>Employment callback pending</span><StatusChip tone="warning" label="manual review" /></div><div className="p-3 rounded border border-border flex justify-between"><span>Police clearance receipt requires verifier sign-off</span><StatusChip tone="warning" label="evidence needed" /></div></div></Card>
          <Card title="Verification Timeline"><Timeline items={view?.timeline ?? []} /></Card>
        </div>
      </Drawer>

      <WorkflowModal open={modal === "note"} onClose={close} title="Add Verification Note" submitLabel="Save Note" onSubmit={submitNote} disabled={notes.trim().length < 5}><div className="space-y-3"><FormField label="Category"><select className={inputCls}><option>Manual review</option><option>Evidence clarification</option><option>Verifier assignment</option></select></FormField><FormField label="Priority"><select className={inputCls}><option>Normal</option><option>High</option></select></FormField><FormField label="Note"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "section"} onClose={close} title={`Review Section${selectedSection ? ` · ${selectedSection.label}` : ""}`} submitLabel="Save Section Decision" submitTone={decision === "rejected" ? "danger" : "success"} onSubmit={submitSection} disabled={notes.trim().length < 5} size="lg"><div className="space-y-3"><div className="h-48 rounded-md border border-border bg-muted/30 grid place-items-center text-[13px] text-muted-foreground">Evidence preview · {selectedSection?.evidence}</div><FormField label="Decision"><select value={decision} onChange={e => setDecision(e.target.value as any)} className={inputCls}><option value="approved">Approve</option><option value="rejected">Reject</option><option value="reupload">Request reupload / clarification</option></select></FormField><FormField label="Verification Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "approve-all"} onClose={close} title="Approve Background Verification" submitLabel="Confirm Approval" submitTone="success" onSubmit={approveAll} disabled={notes.trim().length < 5}><div className="space-y-3"><div className="p-3 rounded-md border border-border bg-muted/30 text-[12.5px]">All pass/fail indicators, verifier assignment, and evidence previews will be locked into the audit log.</div><FormField label="Approval Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
      <WorkflowModal open={modal === "reject-all"} onClose={close} title="Reject Background Verification" submitLabel="Confirm Rejection" submitTone="danger" onSubmit={rejectAll} disabled={notes.trim().length < 10}><div className="space-y-3"><FormField label="Failure Category"><select className={inputCls}><option>Criminal record concern</option><option>Identity mismatch</option><option>Credential fraud risk</option><option>Employment inconsistency</option></select></FormField><FormField label="Rejection Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></FormField></div></WorkflowModal>
    </div>
  );
}
